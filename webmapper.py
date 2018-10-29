#!/usr/bin/env python

import webmapper_http_server as server
import mapper
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

graph = mapper.graph()

def dev_props(dev):
    props = dev.properties.copy()
    if 'synced' in props:
        props['synced'] = props['synced'].get_double()
    props['key'] = dev['name']
    props['status'] = 'active'
    del props['is_local']
    del props['id']
    return props

def sig_props(sig):
    props = sig.properties.copy()
    props['device'] = sig.device()['name']
    props['key'] = props['device'] + '/' + props['name']
    props['num_maps'] = sig['num_maps'];
    props['status'] = 'active'
    del props['is_local']
    del props['id']
    if props['direction'] == mapper.DIR_IN:
        props['direction'] = 'input'
    else:
        props['direction'] = 'output'
    return props

def full_signame(sig):
    return sig.device()['name'] + '/' + sig['name']

def map_props(map):
    props = map.properties.copy()
    props['src'] = full_signame(map.source())
    props['dst'] = full_signame(map.destination())
    props['key'] = props['src'] + '->' + props['dst']
    if props['process_location'] == mapper.LOC_SRC:
        props['process_location'] = 'source'
    else:
        props['process_location'] = 'destination'
    if props['protocol'] == mapper.PROTO_UDP:
        props['protocol'] = 'udp'
    elif props['protocol'] == mapper.PROTO_TCP:
        props['protocol'] = 'tcp'
    else:
        del props['protocol']
    props['status'] = 'active'
    del props['is_local']
    del props['id']

    slotprops = map.source().properties
    if slotprops.has_key('min'):
        props['src_min'] = slotprops['min']
    if slotprops.has_key('max'):
        props['src_max'] = slotprops['max']
    if slotprops.has_key('calibrating'):
        props['src_calibrating'] = slotprops['calibrating']

    slotprops = map.destination().properties
    if slotprops.has_key('min'):
        props['dst_min'] = slotprops['min']
    if slotprops.has_key('max'):
        props['dst_max'] = slotprops['max']
    if slotprops.has_key('calibrating'):
        props['dst_calibrating'] = slotprops['calibrating']
    return props

def on_device(type, dev, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_DEVICE (added or modified)', dev_props(dev)
        server.send_command("add_devices", [dev_props(dev)])
    elif action == mapper.REMOVED:
#        print 'ON_DEVICE (removed)', dev_props(dev)
        server.send_command("del_device", dev_props(dev))
    elif action == mapper.EXPIRED:
#        print 'ON_DEVICE (expired)', dev_props(dev)
        server.send_command("del_device", dev_props(dev))

def on_signal(type, sig, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_SIGNAL (added or modified)', sig_props(sig)
        server.send_command("add_signals", [sig_props(sig)])
    elif action == mapper.REMOVED:
#        print 'ON_SIGNAL (removed)', sig_props(sig)
        server.send_command("del_signal", sig_props(sig))

def on_map(type, map, action):
    if action == mapper.ADDED or action == mapper.MODIFIED:
#        print 'ON_MAP (added or modified)', map_props(map)
        server.send_command("add_maps", [map_props(map)])
    elif action == mapper.REMOVED:
#        print 'ON_MAP (removed)', map_props(map)
        server.send_command("del_map", map_props(map))

def set_map_properties(props):
    # todo: check for convergent maps, only release selected
    maps = find_sig(props['src']).maps().intersect(find_sig(props['dst']).maps())
    map = maps.next()
    if not map:
        print "error: couldn't retrieve map ", props['src'], " -> ", props['dst']
        return
    if props.has_key('expression'):
        map[mapper.PROP_EXPR] = props['expression']
    if props.has_key('muted'):
        map[mapper.PROP_MUTED] = props['muted']

    slot = map.source()
    if props.has_key('src_min'):
        if type(props['src_min']) is int or type(props['src_min']) is float:
            slot.minimum = float(props['src_min'])
        else:
            if type(props['src_min']) is str:
                props['src_min'] = props['src_min'].replace(',',' ').split()
            numargs = len(props['src_min'])
            for i in range(numargs):
                props['src_min'][i] = float(props['src_min'][i])
            if numargs == 1:
                props['src_min'] = props['src_min'][0]
            slot.minimum = props['src_min']
    if props.has_key('src_max'):
        if type(props['src_max']) is int or type(props['src_max']) is float:
            slot.maximum = float(props['src_max'])
        else:
            if type(props['src_max']) is str:
                props['src_max'] = props['src_max'].replace(',',' ').split()
            numargs = len(props['src_max'])
            for i in range(numargs):
                props['src_max'][i] = float(props['src_max'][i])
            if numargs == 1:
                props['src_max'] = props['src_max'][0]
            slot.maximum = props['src_max']
    if props.has_key('src_calibrating'):
        slot.calibrating = props['src_calibrating']

    slot = map.destination()
    if props.has_key('dst_min'):
        if type(props['dst_min']) is int or type(props['dst_min']) is float:
            slot.minimum = float(props['dst_min'])
        else:
            if type(props['dst_min']) is str:
                props['dst_min'] = props['dst_min'].replace(',',' ').split()
            numargs = len(props['dst_min'])
            for i in range(numargs):
                props['dst_min'][i] = float(props['dst_min'][i])
            if numargs == 1:
                props['dst_min'] = props['dst_min'][0]
            slot.minimum = props['dst_min']
    if props.has_key('dst_max'):
        if type(props['dst_max']) is int or type(props['dst_max']) is float:
            slot.maximum = float(props['dst_max'])
        else:
            if type(props['dst_max']) is str:
                props['dst_max'] = props['dst_max'].replace(',',' ').split()
            numargs = len(props['dst_max'])
            for i in range(numargs):
                props['dst_max'][i] = float(props['dst_max'][i])
            if numargs == 1:
                props['dst_max'] = props['dst_max'][0]
            slot.maximum = props['dst_max']
    if props.has_key('dst_calibrating'):
        slot.calibrating = props['dst_calibrating']
#    print 'pushing map'
    map.push()

def on_save(arg):
    d = graph.devices().filter('name', arg['dev']).next()
    fn = d.name+'.json'
    return fn, mapperstorage.serialise(graph, arg['dev'])

def on_load(arg):
    mapperstorage.deserialise(graph, arg['sources'], arg['destinations'], arg['loading'])

def select_interface(iface):
    global graph
    graph.set_interface(iface)
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
    global graph
    graph.subscribe(mapper.DEVICE, -1)
    graph.add_callback(on_device, mapper.DEVICE)
    graph.add_callback(on_signal, mapper.SIGNAL)
    graph.add_callback(on_map, mapper.MAP)

server.add_command_handler("add_devices",
                           lambda x: ("add_devices", map(dev_props, graph.devices())))

def subscribe(device):
    if device == "all_devices":
        graph.subscribe(mapper.DEVICE)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = graph.devices().filter('name', device).next()
        if dev:
            graph.subscribe(dev, mapper.OBJECT)

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = graph.devices().filter('name', names[0]).next()
    if dev:
        sig = dev.signals().filter('name', names[1]).next()
        return sig
    else:
        print 'error: could not find device', dev

def new_map(args):
    map = mapper.map(find_sig(args[0]), find_sig(args[1]))
    if not map:
        print 'error: failed to create map', args[0], "->", args[1]
        return;
    else:
        print 'created map: ', args[0], ' -> ', args[1]
    if len(args) > 2 and type(args[2]) is dict:
        map.set_properties(args[2])
    map.push()

def release_map(args):
    # todo: check for convergent maps, only release selected
    find_sig(args[0]).maps().intersect(find_sig(args[1]).maps()).release()

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("add_signals",
                           lambda x: ("add_signals", map(sig_props, graph.signals())))

server.add_command_handler("add_maps",
                           lambda x: ("add_maps", map(map_props, graph.maps())))

server.add_command_handler("set_map", lambda x: set_map_properties(x))

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

server.serve(port=port, poll=lambda: graph.poll(100), on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)

