var devices =   {
                    "name" : "devices",
                    "children" : []
                };

var devices2 = new Assoc();

var partition;
var arc;
var vis;
var w = 960,
    h = 960,
    r = Math.min(w, h) / 2,
    color = d3.scale.category20c();
var i = 0;
var timer_is_on = 0;

function setup_display()
{
    partition = d3.layout.partition()
        .sort(null)
        .size([2 * Math.PI, r * r])
        .value(function(d) { return 1; });

    arc = d3.svg.arc()
        .startAngle(function(d) { return d.x })
        .endAngle(function(d) { return d.x + d.dx; })
        .innerRadius(function(d) { return Math.sqrt(d.y); })
        .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });

    vis = d3.select("#chart").append("svg")
        .attr("width", w)
        .attr("height", h)
      .append("g")
        .attr("transform", "translate(" + w/2 + "," + h/2 + ")");

    update_display();
}

function update_display()
{
    if (!timer_is_on) {
        timer_is_on = 1;
        setTimeout("real_update_display()", 500);
    }
}

function real_update_display()
{
    var nodes = partition.nodes(devices);

    //nodes.forEach(function(d) { d.y = d.depth * 180; });

/*    var link = vis.selectAll("path.link")
        .data(cluster.links(nodes), function(d) { return d.target.id; });

    link.enter().append("svg:path", "g")
        .attr("class", "link")
        .attr("d", diagonal);

    link.transition()
        .attr("d", diagonal);

    link.exit().transition()
        .remove();*/

    var path = vis.selectAll("path")
        .data(nodes);

    var pathEnter = path.enter().append("path")
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("stroke", "#fff")
        .style("fill", function(d) { return color((d.children ? d : d.parent).name); })
        .each(stash);

    /*nodeEnter.append("circle")
        .attr("r", 1e-6)
        .style("fill", function(d) { return d.children ? "lightsteelblue" : "#fff"; });*/

    pathEnter.append("text")
        .attr("transform", function(d) { "translate(100,100)"; })
        .text(function(d) { return d.name; });
        /*
        .attr("x", function(d) { return d.x < 180 ? 10 : -10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)" })
        .text(function(d) { return d.name; })
        .style("fill-opacity", 1e-6);*/

    var pathUpdate = path.transition()
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("stroke", "#fff")
        .style("fill", function(d) { return color((d.children ? d : d.parent).name); })
        .style("fill-opacity", 0.5)
        .each(stash);

    /*nodeUpdate.select("circle")
        .attr("r", 4.5)
        .style("fill", function(d) { return d.children ? "lightsteelblue" : "#fff"; });*/

    pathUpdate.select("text")
        .attr("x", 100)
        .attr("dy", ".35em")
        .attr("transform", function(d) { "translate(100,100)"; })
        .text(function(d) { return d.name; });
        /*
        .attr("x", function(d) { return d.x < 180 ? 10 : -10; })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)" })
        .text(function(d) { return d.name; })
        .style("fill-opacity", 1);*/

    var pathExit = path.exit().transition()
        .remove();

    /*nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);*/

    timer_is_on = 0;
}

// Stash the old values for transition.
function stash(d) {
  d.x0 = d.x;
  d.dx0 = d.dx;
}

/* The main program. */
function main()
{
    command.register("all_devices", function(cmd, args) {
        for (d in args) {
            devices.children.push({ "name" : args[d].name,
                                    "children" : [] });
            devices2[args[d].name] = args;
            devices2[args[d].name].signals = {};
        }
        update_display();
    });
    command.register("new_device", function(cmd, args) {
        devices.children.push({ "name" : args.name,
                                "children" : [] });
        devices2[args.name] = args;
        devices2[args.name].signals = {};
        update_display();
    });
    command.register("del_device", function(cmd, args) {
        //mapping.children[0].remove(args.name);
//        update_display();
    });

    command.register("all_signals", function(cmd, args) {
        // find device
        for (d in args) {
            var index = -1;
            for (i in devices.children) {
                if (devices.children[i].name == args[d].device_name) {
                    devices.children[i].children.push({ "name" : args[d].name,
                                                        "props" : 0 });
                    break;
                }
            }
            devices2[args[d].device_name].signals[args[d].name] = args;
        }
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        // find device
        var index = -1;
        for (i in devices.children) {
            if (devices.children[i].name == args.device_name) {
                devices.children[i].children.push({ "name" : args.name,
                                                    "props" : 0 });
                update_display();
                break;
            }
        }
        devices2[args.device_name].signals[args.name] = args;
    });
//    command.register("del_signal", function(cmd, args) {
//        mapping.children[1].remove(args.device_name+args.name
//                       +'/_dir_'+args.direction);
//        update_display();
//    });

/*    command.register("all_links", function(cmd, args) {
        var length = mapping.children[1].children.length;
        for (l in args)
            mapping.children[1].children[length] = { "name" : args[l].src_name+'>'+args[l].dest_name };
        update_display();
    });
    command.register("new_link", function(cmd, args) {
        var length = mapping.children[1].children.length;
        mapping.children[1].children[length] = { "name" : args.src_name+'>'+args.dest_name };
        update_display();
    });
    command.register("del_link", function(cmd, args) {
        mapping.children[2].remove(args.src_name+'>'+args.dest_name);
        update_display();
    });

    command.register("all_connections", function(cmd, args) {
        var length = mapping.children[2].children.length;
        for (d in args)
            mapping.children[2].children[length] = { "name" : args[d].src_name+'>'+args[d].dest_name };
        update_display();
    });
    command.register("new_connection", function(cmd, args) {
        var length = mapping.children[2].children.length;
        mapping.children[2].children[length] = { "name" : args.src_name+'>'+args.dest_name };
        update_display();
    });
    command.register("mod_connection", function(cmd, args) {
        mapping.children[3].add(args.src_name+'>'+args.dest_name, args);
        update_display();
    });
    command.register("del_connection", function(cmd, args) {
        mapping.children[3].remove(args.src_name+'>'+args.dest_name);
        update_display();
    });
*/
    // Delay starting polling, because it results in a spinning wait
    // cursor in the browser.
    setTimeout(
        function(){
            setup_display();
            command.start();
            command.send('all_devices');
            command.send('all_signals');
            command.send('all_links');
            command.send('all_connections');
            window.onresize = function (e) {
                //position_dynamic_elements();
            };
        },
        100);
}

/* Kick things off. */
window.onload = main;
