#!/usr/bin/env python

import webmapper_http_server as server
import mpr
import mapperstorage
import netifaces # a library to find available network interfaces
import sys, os, os.path, threading, json, re, pdb
from random import randint

networkInterfaces = {'active': '', 'available': []}

dirname = os.path.dirname(__file__)
if dirname:
   os.chdir(os.path.dirname(__file__))

if 'tracing' in sys.argv[1:]:
    server.tracing = True

def open_gui(port):
    url = 'http://localhost:%d'%port
    apps = ['~\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe --app=%s',
            '/usr/bin/chromium-browser --app=%s',
            ]
    if 'darwin' in sys.platform:
        # Dangerous to run 'open' on platforms other than OS X, so
        # check for OS explicitly in this case.
        apps = ['open -n -a "Google Chrome" --args --app=%s']
    def launch():
        try:
            import webbrowser, time
            time.sleep(0.2)
            for a in apps:
                a = os.path.expanduser(a)
                a = a.replace('\\','\\\\')
                if webbrowser.get(a).open(url):
                    return
            webbrowser.open(url)
        except:
            print 'Error opening web browser, continuing anyway.'
    launcher = threading.Thread(target=launch)
    launcher.start()

g = mpr.graph()

def dev_props(dev):
    props = dev.properties.copy()
    if 'synced' in props:
        props['synced'] = props['synced'].get_double()
    props['key'] = dev['name']
    props['status'] = 'active'
    if 'is_local' in props:
        del props['is_local']
    if 'id' in props:
        del props['id']
    return props

def sig_props(sig):
    props = sig.properties.copy()
    props['device'] = sig.device()['name']
    props['key'] = props['device'] + '/' + props['name']
    props['num_maps'] = len(sig.maps());
    props['status'] = 'active'
    del props['is_local']
    del props['id']
    if props['direction'] == mpr.DIR_IN:
        props['direction'] = 'input'
    else:
        props['direction'] = 'output'
    if props['type'] == mpr.INT32:
        props['type'] = 'i'
    elif props['type'] == mpr.FLT:
        props['type'] = 'f'
    elif props['type'] == mpr.DBL:
        props['type'] = 'd'
    return props

def full_signame(sig):
    return sig.device()['name'] + '/' + sig['name']

def map_props(map):
    props = map.properties.copy()
    props['src'] = full_signame(map.signal(mpr.LOC_SRC))
    props['dst'] = full_signame(map.signal(mpr.LOC_DST))
    props['key'] = props['src'] + '->' + props['dst']
    if props['process_loc'] == mpr.LOC_SRC:
        props['process_loc'] = 'src'
    else:
        props['process_loc'] = 'dst'
    if props['protocol'] == mpr.PROTO_UDP:
        props['protocol'] = 'udp'
    elif props['protocol'] == mpr.PROTO_TCP:
        props['protocol'] = 'tcp'
    else:
        del props['protocol']
    props['status'] = 'active'
    del props['is_local']
    del props['id']

    slotprops = map.signal(mpr.LOC_SRC).properties
    if slotprops.has_key('min'):
        props['src_min'] = slotprops['min']
    if slotprops.has_key('max'):
        props['src_max'] = slotprops['max']
    if slotprops.has_key('calib'):
        props['src_calibrating'] = slotprops['calib']

    slotprops = map.signal(mpr.LOC_DST).properties
    if slotprops.has_key('min'):
        props['dst_min'] = slotprops['min']
    if slotprops.has_key('max'):
        props['dst_max'] = slotprops['max']
    if slotprops.has_key('calib'):
        props['dst_calibrating'] = slotprops['calib']
    return props

def on_device(type, dev, action):
    print "on_dev"
    if action == mpr.OBJ_NEW or action == mpr.OBJ_MOD:
#        print 'ON_DEVICE (added or modified)', dev_props(dev)
        server.send_command("add_devices", [dev_props(dev)])
    elif action == mpr.OBJ_REM:
#        print 'ON_DEVICE (removed)', dev_props(dev)
        server.send_command("del_device", dev_props(dev))
    elif action == mpr.OBJ_EXP:
#        print 'ON_DEVICE (expired)', dev_props(dev)
        server.send_command("del_device", dev_props(dev))

def on_signal(type, sig, action):
    print "on_sig"
    if action == mpr.OBJ_NEW or action == mpr.OBJ_MOD:
#        print 'ON_SIGNAL (added or modified)', sig_props(sig)
        server.send_command("add_signals", [sig_props(sig)])
    elif action == mpr.OBJ_REM:
#        print 'ON_SIGNAL (removed)', sig_props(sig)
        server.send_command("del_signal", sig_props(sig))

def on_map(type, map, action):
    print "on_map"
    if action == mpr.OBJ_NEW or action == mpr.OBJ_MOD:
#        print 'ON_MAP (added or modified)', map_props(map)
        server.send_command("add_maps", [map_props(map)])
    elif action == mpr.OBJ_REM:
#        print 'ON_MAP (removed)', map_props(map)
        server.send_command("del_map", map_props(map))

def set_map_properties(props, map):
    # todo: check for convergent maps, only release selected
    if not map:
        print "error: couldn't retrieve map ", props['src'], " -> ", props['dst']
        return
    del props['src']
    del props['dst']
    for key in props:
        print 'prop', key, props[key]
        val = props[key]
        if val == 'true' or val == 'True' or val == 't' or val == 'T':
            val = True
        elif val == 'false' or val == 'False' or val == 'f' or val == 'F':
            val = False
        elif val == 'null' or val == 'Null':
            val = None
        if key == 'expr':
            map[mpr.PROP_EXPR] = val
        elif key == 'muted':
            if val == True or val == False:
                map[mpr.PROP_MUTED] = val
#        elif key is 'src_min':
#            if type(props['src_min']) is int or type(props['src_min']) is float:
#                src.minimum = float(props['src_min'])
#            else:
#                if type(props['src_min']) is str:
#                    props['src_min'] = props['src_min'].replace(',',' ').split()
#                numargs = len(props['src_min'])
#                for i in range(numargs):
#                    props['src_min'][i] = float(props['src_min'][i])
#                if numargs == 1:
#                    props['src_min'] = props['src_min'][0]
#                src.minimum = props['src_min']
#        elif key is 'src_max':
#            if type(props['src_max']) is int or type(props['src_max']) is float:
#                src.maximum = float(props['src_max'])
#            else:
#                if type(props['src_max']) is str:
#                    props['src_max'] = props['src_max'].replace(',',' ').split()
#                numargs = len(props['src_max'])
#                for i in range(numargs):
#                    props['src_max'][i] = float(props['src_max'][i])
#                if numargs == 1:
#                    props['src_max'] = props['src_max'][0]
#                dst.maximum = props['src_max']
#        elif key is 'dst_min':
#            if type(props['dst_min']) is int or type(props['dst_min']) is float:
#                dst.minimum = float(props['dst_min'])
#            else:
#                if type(props['dst_min']) is str:
#                    props['dst_min'] = props['dst_min'].replace(',',' ').split()
#                numargs = len(props['dst_min'])
#                for i in range(numargs):
#                    props['dst_min'][i] = float(props['dst_min'][i])
#                if numargs == 1:
#                    props['dst_min'] = props['dst_min'][0]
#                dst.minimum = props['dst_min']
#        elif key is 'dst_max':
#            if type(props['dst_max']) is int or type(props['dst_max']) is float:
#                dst.maximum = float(props['dst_max'])
#            else:
#                if type(props['dst_max']) is str:
#                    props['dst_max'] = props['dst_max'].replace(',',' ').split()
#                numargs = len(props['dst_max'])
#                for i in range(numargs):
#                    props['dst_max'][i] = float(props['dst_max'][i])
#                if numargs == 1:
#                    props['dst_max'] = props['dst_max'][0]
#                dst.maximum = props['dst_max']
        else:
            map[key] = val
#    print 'pushing map'
    map.push()

def on_save(arg):
    d = g.devices().filter(mpr.PROP_NAME, arg['dev']).next()
    fn = d.name+'.json'
    return fn, mapperstorage.serialise(g, arg['dev'])

def on_load(arg):
    mapperstorage.deserialise(g, arg['sources'], arg['destinations'], arg['loading'])

def select_interface(iface):
    global g
    g.set_interface(iface)
    networkInterfaces['active'] = iface
    server.send_command('set_iface', iface)

def get_interfaces(arg):
    location = netifaces.AF_INET    # A computer specific integer for internet addresses
    totalInterfaces = netifaces.interfaces() # A list of all possible interfaces
    connectedInterfaces = []
    for i in totalInterfaces:
        addrs = netifaces.ifaddresses(i)
        if location in addrs:       # Test to see if the interface is actually connected
            connectedInterfaces.append(i)
    server.send_command("available_interfaces", connectedInterfaces)
    networkInterfaces['available'] = connectedInterfaces
    server.send_command("active_interface", networkInterfaces['active'])

def init_graph(arg):
    global g
    g.subscribe(mpr.DEV, -1)
    g.add_callback(on_device, mpr.DEV)
    g.add_callback(on_signal, mpr.SIG)
    g.add_callback(on_map, mpr.MAP)

server.add_command_handler("add_devices",
                           lambda x: ("add_devices", map(dev_props, g.devices())))

def subscribe(device):
    if device == "all_devices":
        g.subscribe(mpr.DEV)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = g.devices().filter(mpr.PROP_NAME, device).next()
        if dev:
            g.subscribe(dev, mpr.OBJ)

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = g.devices().filter(mpr.PROP_NAME, names[0]).next()
    if dev:
        sig = dev.signals().filter(mpr.PROP_NAME, names[1]).next()
        return sig
    else:
        print 'error: could not find device', names[0]

def new_map(args):
    if find_sig(args[0]) and find_sig(args[1]):
        map = mpr.map(find_sig(args[0]), find_sig(args[1]))
        if not map:
            print 'error: failed to create map', args[0], "->", args[1]
            return;
        else:
            print 'created map: ', args[0], ' -> ', args[1]
        if len(args) > 2 and type(args[2]) is dict:
            set_map_properties(args[2], map)
        map.push()
    else:
       print args[0], ' and ', args[1], ' not found on network!'

def release_map(args):
    # todo: check for convergent maps, only release selected
    find_sig(args[0]).maps().intersect(find_sig(args[1]).maps()).release()

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("add_signals",
                           lambda x: ("add_signals", map(sig_props, g.signals())))

server.add_command_handler("add_maps",
                           lambda x: ("add_maps", map(map_props, g.maps())))

server.add_command_handler("set_map", lambda x: set_map_properties(x, None))

server.add_command_handler("map", lambda x: new_map(x))

server.add_command_handler("unmap", lambda x: release_map(x))

server.add_command_handler("refresh", init_graph)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)

server.add_command_handler("select_interface", select_interface)
server.add_command_handler("get_interfaces", get_interfaces)

get_interfaces(False)
if ( 'en1' in networkInterfaces['available'] ) :
    networkInterfaces['active'] = 'en1'
elif ( 'en0' in networkInterfaces['available'] ):
    networkInterfaces['active'] = 'en0'
elif ( 'lo0' in networkInterfaces['available'] ):
    networkInterfaces['active'] = 'lo0'

try:
    port = int(sys.argv[sys.argv.index('--port'):][1])
except:
    #port = randint(49152,65535)
    port = 50000

on_open = lambda: ()
if not '--no-browser' in sys.argv and not '-n' in sys.argv:
    on_open = lambda: open_gui(port)

server.serve(port=port, poll=lambda: g.poll(100), on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)

