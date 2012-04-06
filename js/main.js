var devices =   {
                    "name" : "devices",
                    "children" : []
                };

var cluster;
var diagonal;
var vis;
var w = 960;
var h = 1000;
var i = 0;

function setup_display()
{
    cluster = d3.layout.cluster()
        .size([h, w - 160]);

    diagonal = d3.svg.diagonal()
        .projection(function(d) { return [d.y, d.x]; });

    vis = d3.select("#chart").append("svg:svg")
        .attr("width", w)
        .attr("height", h)
      .append("svg:g")
        .attr("transform", "translate(50, 0)");

    update_display();
}

function update_display()
{
    var nodes = cluster.nodes(devices).reverse();

    var node = vis.selectAll("g.node")
        .data(nodes, function(d) { return d.id || (d.id = ++i); });

    var nodeEnter = node.enter().append("svg:g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    nodeEnter.append("circle")
        .attr("r", 4.5);

    nodeEnter.append("text")
        .attr("dx", function(d) { return d.children ? -8 : 8; })
        .attr("dy", 3)
        .attr("text-anchor", function(d) { return d.children ? "end" : "start"; })
        .text(function(d) { return d.name; });

    var nodeUpdate = node.transition()
        .duration(1000)
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    var NodeExit = node.exit().remove();

    var link = vis.selectAll("path.link")
        .data(cluster.links(nodes), function(d) { return d.target.id; });

    link.enter().append("svg:path", "g")
        .attr("class", "link")
        .attr("d", diagonal);

    link.transition()
        .duration(1000)
        .attr("d", diagonal);

    link.exit().remove();
}

/* The main program. */
function main()
{
    command.register("all_devices", function(cmd, args) {
        for (d in args) {
            for (i in devices.children) {
                if (devices.children[i].name == args[d].name)
                    return;
            }
            devices.children.push({ "name" : args[d].name,
                                    "children" : [] });
        }
        update_display();
    });
    command.register("new_device", function(cmd, args) {
        for (i in devices.children) {
                if (devices.children[i].name == args.name)
                    return;
        }
        devices.children.push({ "name" : args.name,
                                "children" : [] });
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
        }
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        // find device
        var index = -1;
        for (i in mapping.children[0].children) {
            if (devices.children[i].name == args.device_name) {
                devices.children[i].children.push({ "name" : args.name,
                                                    "props" : 0 });
                update_display();
                return;
            }
        }
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
