var mapping =   {
                    "name" : "mapping",
                    "children" : [
                        { "name" : "devices", "children" : [] },
                        { "name" : "signals", "children" : [] },
                        { "name" : "links", "children" : [] },
                        { "name" : "connections", "children" : [] }
                    ]
                };

var cluster;
var diagonal;
var vis;
var nodes;
var link;
var node;

function setup_display()
{
    var w = 960;
    var h = 1000;

    cluster = d3.layout.cluster()
        .size([h, w - 160]);

    diagonal = d3.svg.diagonal()
        .projection(function(d) { return [d.y, d.x]; });

    vis = d3.select("#chart").append("svg")
        .attr("width", w)
        .attr("height", h)
      .append("g")
        .attr("transform", "translate(50, 0)");

    update_display();
}

function update_display()
{
    nodes = cluster.nodes(mapping.children[0]);

    link = vis.selectAll("path.link")
        .data(cluster.links(nodes))
      .enter().append("path")
        .attr("class", "link")
        .attr("d", diagonal);

    node = vis.selectAll("g.node")
        .data(nodes)
      .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    node.append("circle")
        .attr("r", 4.5);

    node.append("text")
        .attr("dx", function(d) { return d.children ? -8 : 8; })
        .attr("dy", 3)
        .attr("text-anchor", function(d) { return d.children ? "end" : "start"; })
    .text(function(d) { return d.name; });
}

/* The main program. */
function main()
{
    command.register("all_devices", function(cmd, args) {
        var length = mapping.children[0].children.length;
        for (d in args)
            mapping.children[0].children[length++] = { "name" : args[d].name };
        update_display();
    });
    command.register("new_device", function(cmd, args) {
        var length = mapping.children[0].children.length;
        mapping.children[0].children[length] = { "name" : args.name };
        mapping.children[0].children[length].foo = 0;
        update_display();
    });
    command.register("del_device", function(cmd, args) {
        //mapping.children[0].remove(args.name);
//        update_display();
    });

    command.register("all_signals", function(cmd, args) {
        var length = mapping.children[1].children.length;
        for (d in args)
            mapping.children[1].children[length++] = { "name" : args[d].name };
        update_display();
    });
    command.register("new_signal", function(cmd, args) {
        var length = mapping.children[1].children.length;
        mapping.children[1].children[length] = { "name" : args.name };
        update_display();
    });
    command.register("del_signal", function(cmd, args) {
//        mapping.children[1].remove(args.device_name+args.name
//                       +'/_dir_'+args.direction);
//        update_display();
    });

    command.register("all_links", function(cmd, args) {
        var length = mapping.children[2].children.length;
        for (l in args)
            mapping.children[2].children[length] = { "name" : args[l].src_name+'>'+args[l].dest_name };
        update_display();
    });
    command.register("new_link", function(cmd, args) {
        var length = mapping.children[2].children.length;
        mapping.children[2].children[length] = { "name" : args.src_name+'>'+args.dest_name };
        update_display();
    });
    command.register("del_link", function(cmd, args) {
//        mapping.children[2].remove(args.src_name+'>'+args.dest_name);
//        update_display();
    });

    command.register("all_connections", function(cmd, args) {
        var length = mapping.children[3].children.length;
        for (d in args)
            mapping.children[3].children[length] = { "name" : args[d].src_name+'>'+args[d].dest_name };
        update_display();
    });
    command.register("new_connection", function(cmd, args) {
        var length = mapping.children[3].children.length;
        mapping.children[3].children[length] = { "name" : args.src_name+'>'+args.dest_name };
        update_display();
    });
    command.register("mod_connection", function(cmd, args) {
//        mapping.children[3].add(args.src_name+'>'+args.dest_name, args);
//        update_display();
    });
    command.register("del_connection", function(cmd, args) {
//        mapping.children[3].remove(args.src_name+'>'+args.dest_name);
//        update_display();
    });

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
