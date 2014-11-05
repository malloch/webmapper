// An object for the overall display
function listView(model) {
    var svgns = 'http://www.w3.org/2000/svg';
    var all_devices = 'All Devices';

    var tabList = null;
    var tabDevices = null;
    var selectedTab = null;
    var leftTable = null;
    var rightTable = null;
    var svgArea = null;
    var selectLists = {};
    var devActions = null;
    var sigActions = null;
    var arrows = [];
    // The most recently selected rows, for shift-selecting
    var lastSelectedTr = {left: null, right: null};

    var sourceDeviceHeaders = ["name", "outputs", "IP", "port"];
    var destinationDeviceHeaders = ["name", "inputs", "IP", "port"];
    var signalHeaders = ["name", "type", "length", "units", "min", "max"];

    // "use strict";
    this.type = 'list';
    this.unconnectedVisible = true; // Are unconnected devices/signals visible?
    this.focusedDevices = []; // An array containing devices seen in the display

    var leftBodyContent = [];
    var rightBodyContent = [];

    this.init = function() {
        add_tabs();
        add_title_bar();
        add_display_tables();
        add_svg_area();
        add_status_bar();
        this.add_handlers();
        select_tab(tabDevices);
        $('#container').css({
            'min-width': '700px',
            'min-height': '150px',
            'height': 'calc(100% - 85px)'
        });
        this.update_display();
    };

    this.cleanup = function() {
        // Remove view specific handlers
        $('*').off('.list');
        $(document).off('.list');
    };

    this.update_display = function() {
        // Removes 'invisible' classes which can muddle with display updating
        $('tr.invisible').removeClass('invisible');
        update_arrows();
        update_tabs();

        if (selectedTab == all_devices) {
            update_devices();
        }
        else if (!model.isLinked(selectedTab, null)) {
            select_tab(tabDevices);
            return;
        }
        else {
            update_signals(selectedTab);
        }

        update_selection();
        filter_view();
        // update_row_heights();

        $('#container').trigger("updateSaveLocation");    // trigger update save location event
    };

    this.get_save_location = function() {
        if (selectedTab == all_devices) {
            // nothing to save if in the devices tab
            return '';
        }
        else {
            return '/save?dev='+encodeURIComponent(selectedTab);
        }
    };

    this.get_selected_connections = function() {
        var selected = get_selected_rows();
        var keys = model.connections.keys();
        var vals = [];

        for (var k in keys) {
            var c = model.connections.get(keys[k]);
            // check if src_name and dest_name are selected
            if (   selected.indexOf(c.src_name) >= 0
                && selected.indexOf(c.dest_name) >= 0)
                vals.push(c);
        }
        return vals;
    };

    this.get_selected_tab = function() {
        return selectedTab;
    }

    this.get_focused_devices = function() {
        if (selectedTab == all_devices) {
            return null;
        }

        var focusedDevices = new Assoc();
        var sourceDevice = model.devices.get(selectedTab);

        focusedDevices.add(sourceDevice.name, sourceDevice);

        var links = model.links.keys();
        for (var i in links) {
            var devs = links[i].split('>');
            if (devs[0] == sourceDevice.name) {
                var destD = model.devices.get(devs[1]);
                focusedDevices.add(destD.name, destD);
            }
        }

        return focusedDevices;
    };

    this.on_resize = function() {
        update_arrows();
        update_row_heights();
    };

    // A function to make sure that rows fill up the available space, in testing for now
    function update_row_heights() {
        var tableHeight = $('.tableDiv').height() - $('.tableDiv thead').height();
        var leftHeight = Math.floor(tableHeight/leftTable.nVisibleRows);
        var rightHeight = Math.floor(tableHeight/rightTable.nVisibleRows);

        $('#leftTable tbody tr').css('height', leftHeight+'px');
        $('#rightTable tbody tr').css('height', rightHeight+'px');
    }

    // An object for the left and right tables, listing devices and signals
    function listTable(id) {
        this.id = id; // Something like "leftTable"
        this.parent; // The node containing the table
        this.div; // The div node (and status)
        this.table; // The table node itself
        this.headerRow; // The top row node of the table within <thead>
        this.tbody; // The <tbody> node
        this.footer; // The status bar at the bottom

        this.nRows; // Number of rows (e.g. devices or signals) present
        this.nVisibleRows; // Number of rows actually visible to the user
        this.nCols; // Number of columns in table

        // Should be passed a the node for the parent
        this.create_within = function(parent) {
            this.parent = parent;
            // Create the div containing the table
            $(this.parent).append("<div class='tableDiv' id='"+id+"'></div>");
            this.div = $(this.parent).children("#"+this.id);

            // Create the skeleton for the table within the div
            $(this.div).append(
                "<table class='displayTable'>"+
                    "<thead><tr></tr></thead>"+
                    "<tbody></tbody>"+
                "</table>");
            this.table = $(this.div).children('.displayTable')[0];
            this.headerRow = $("#"+this.id+" .displayTable thead tr")[0];
            this.tbody = $("#"+this.id+" .displayTable tbody")[0];

            // Create the header elements
            // This assumes that we will never need more than 20 columns
            // Creating and destroying th elements themselves screws up tablesorter
            for (var i=0; i<20; i++) {
                $(this.headerRow).append("<th class='invisible'></th>");
            }
        };

        // e.g. headerStrings = ["Name", "Units", "Min", "Max"]
        this.set_headers = function(headerStrings) {
            this.nCols = headerStrings.length;

            $(this.headerRow).children('th').each(function(index) {
                if (index < headerStrings.length)
                    $(this).text(headerStrings[index]).removeClass("invisible");
                else
                    $(this).text("").addClass("invisible");
            });
        };

        // For when something changes on the network
        this.update = function(tableData, headerStrings) {
            $(this.tbody).empty();
            for (var row in tableData) {
                // If there is only one row, make it of even class for styling
                var newRow = "<tr>";
                for (var col in tableData[row]) {
                    if (tableData[row][col]==undefined)
                        tableData[row][col] = '';
                    newRow += "<td class="+headerStrings[col]+">"+tableData[row][col]+"</td>";
                }
                $(this.tbody).append(newRow+"</tr>");
            }
            this.nRows = tableData.length;
            if (tableData[0])
                this.nCols = tableData[0].length;
            $(this.table).trigger('update');
        };

        this.set_status = function() {
            var name; // Devices or signals
            if (selectedTab == all_devices) {
                name = "devices";
            }
            else name = "signals";
            this.nVisibleRows = $(this.tbody).children('tr').length - $(this.tbody).children('tr.invisible').length;
            $(this.footer).text(this.nVisibleRows+" of "+this.nRows+" "+name);

            // For styling purposes when there is only a single row
            if (this.nVisibleRows == 1)
                $(this.tbody).children('tr').addClass('even');
        };
    }

    function update_devices() {
        var keys = model.devices.keys();

        leftBodyContent = [];
        rightBodyContent = [];

        leftTable.set_headers(sourceDeviceHeaders);
        rightTable.set_headers(destinationDeviceHeaders);

        for (var d in keys) {
            var k = keys[d];
            var dev = model.devices.get(k);

            if (dev.num_inputs > dev.num_outputs)
                rightBodyContent.push([dev.name, dev.num_inputs,
                                       dev.host, dev.port]);
            else
                leftBodyContent.push([dev.name, dev.num_outputs,
                                      dev.host, dev.port]);
        }

        leftTable.set_status();
        rightTable.set_status();

        leftTable.update(leftBodyContent, sourceDeviceHeaders);
        rightTable.update(rightBodyContent, destinationDeviceHeaders);
    }

    function update_signals() {
        // display all signals of selected device and linked devices
        var keys = model.signals.keys();

        leftBodyContent = [];
        rightBodyContent = [];

        for (var s in keys) {
            var k = keys[s];
            var sig = model.signals.get(k);
            var lnk1 = model.links.get(selectedTab+'>'+sig.device_name);
            var lnk2 = model.links.get(sig.device_name+'>'+selectedTab);
            if (sig.device_name != selectedTab && lnk1 == null && lnk2 == null)
                continue;

            // So that all browsers break the line properly
            var sigName = sig.name.replace(RegExp('/','g'), '<wbr>/');
            if (sig.direction == 1) {
                leftBodyContent.push([sig.device_name+sigName, sig.type,
                                      sig.length, sig.unit, sig.min, sig.max]);
            }
            else {
                rightBodyContent.push([sig.device_name+sigName, sig.type,
                                       sig.length, sig.unit, sig.min, sig.max]);
            }
        }

        leftTable.set_status();
        rightTable.set_status();

        leftTable.update(leftBodyContent, signalHeaders);
        rightTable.update(rightBodyContent, signalHeaders);
    }

    function update_tabs() {
        var t = tabDevices;
        var keys = model.devices.keys();
        for (var d in keys) {
            var k = keys[d];
            var dev = model.devices.get(k);
            if (dev.num_links == 0) {
                console.log("no tab for device "+dev.name);
                continue;
            }

            if (t.nextSibling)
                t = t.nextSibling;
            else {
                var x = document.createElement('li');
                x.onclick = function(y) {
                    return function(e) { select_tab(y);
                                         e.stopPropagation(); };
                } (x);
                t.parentNode.appendChild(x);
                t = x;
            }
            t.innerHTML = dev.name;
        }
        if (t) t = t.nextSibling;
        while (t) {
            var u = t.nextSibling;
            t.parentNode.removeChild(t);
            t = u;
        }
    }

    function update_selection() {
        var l = selectLists[selectedTab];
        if (!l) return;

        function checksel(table, i) {
            if (!selectLists[selectedTab])
                return;
            var l = selectLists[selectedTab][i];
            if (!l) return;
            var tr = $(table).children('tbody').children('tr')[0];
            while (tr && tr.firstChild) {
                if (l.get(tr.firstChild.innerHTML.replace(/<wbr>/g, '')))
                    $(tr).addClass("trsel");
                else
                    $(tr).removeClass("trsel");
                tr = tr.nextSibling;
            }
        }

        checksel(leftTable.table, 0);
        checksel(rightTable.table, 1);
    }

    function cleanup_arrows() {
        for (var a in arrows) {
            arrows[a].border.remove();
            arrows[a].remove();
        }
        arrows = [];
    }

    function update_links() {
        cleanup_arrows();

        // How many are actually being displayed?
        var n_visibleLinks = 0;

        var keys = model.links.keys();
        for (var k in keys) {
            var l = model.links.get(keys[k]);
            var src_found = 0;
            var dest_found = 0;

            for (var i = 0, row; row = leftTable.table.rows[i]; i++) {
                if (row.cells[0].textContent == l.src_name) {
                    var src = row;
                    src_found = 1;
                }
                if (row.cells[0].textContent == l.dest_name) {
                    var dest = row;
                    dest_found = 1;
                }
                if (src_found && dest_found)
                    break;
            }
            if (!src_found || !dest_found) {
                for (var i = 0, row; row = rightTable.table.rows[i]; i++) {
                    if (row.cells[0].textContent == l.src_name) {
                        var src = row;
                        src_found = 2;
                    }
                    if (row.cells[0].textContent == l.dest_name) {
                        var dest = row;
                        dest_found = 2;
                    }
                    if (src_found && dest_found)
                        break;
                }
            }
            if (src_found && dest_found) {
                var srcsel = $(src).hasClass('trsel');
                var destsel = $(dest).hasClass('trsel');
                // Are these rows being displayed?
                if ($(src).css('display') != 'none'
                    && $(dest).css('display') != 'none') {
                    create_arrow(src, dest, src_found | (dest_found << 2),
                                 srcsel && destsel, 0);
                    n_visibleLinks++;
                }
            }
        }

        $('.status.middle').text(
            n_visibleLinks + " of " + model.links.keys().length + " links");
    }

    // Because this is a heavy function, I want to prevent it from being called too rapidly
    // (it is also never necessary to do so)
    // It is currently called with a delay of 34ms, if it is called again within that delay
    // The first call is forgotten.
    var arrowTimeout;
    var arrowCallable = true;
    var timesArrowsCalled = 0;

    function update_arrows() {
        if (arrowCallable == false) {
            clearTimeout(arrowTimeout);
        }
        timesArrowsCalled++;

        arrowCallable = false;
        arrowTimeout = setTimeout(function() {

            if (selectedTab == all_devices)
                update_links();
            else
                update_connections();
            arrowCallable = true;
        }, 0);
    }

    function update_connections() {
        cleanup_arrows();
        var n_connections = 0;
        var n_visibleConnections = 0;

        var keys = model.connections.keys();
        for (var k in keys) {
            var c = model.connections.get(keys[k]);
            var muted = c.muted;
            var src_found = 0;
            var dest_found = 0;

            for (var i = 0, row; row = leftTable.table.rows[i]; i++) {
                if (row.cells[0].textContent == c.src_name) {
                    var src = row;
                    src_found = 1;
                }
                else if (row.cells[0].textContent == c.dest_name) {
                    var dest = row;
                    dest_found = 1;
                }
                if (src_found && dest_found)
                    break;
            }
            if (!src_found || !dest_found) {
                for (var i = 0, row; row = rightTable.table.rows[i]; i++) {
                    if (row.cells[0].textContent == c.src_name) {
                        var src = row;
                        src_found = 2;
                    }
                    else if (row.cells[0].textContent == c.dest_name) {
                        var dest = row;
                        dest_found = 2;
                    }
                    if (src_found && dest_found)
                        break;
                }
            }
            if (src_found && dest_found) {
                var srcsel = $(src).hasClass('trsel');
                var destsel = $(dest).hasClass('trsel');
                // Are these rows being displayed?
                if ($(src).css('display') != 'none'
                    && $(dest).css('display') != 'none') {
                    create_arrow(src, dest, src_found | (dest_found << 2),
                                 srcsel && destsel, c.muted);
                    n_visibleConnections++;
                }
                n_connections++;
            }
        }

        $('.status.middle').text(
            n_visibleConnections + " of " + n_connections + " connections");

        if (!n_connections)
            $('#saveButton').addClass('disabled');
    }

    // A function for filtering out unconnected signals
    // Or signals that do not match the search string
    function filter_view() {
        $('.displayTable tbody tr').each(function(i, row) {
            if ((view.unconnectedVisible || is_connected(this)) && filter_match(this))
                $(this).removeClass('invisible');
            else
                $(this).addClass('invisible');
        });

        update_arrows();
        $(leftTable.table).trigger('update');
        $(rightTable.table).trigger('update');

        rightTable.set_status();
        leftTable.set_status();

        update_row_heights();
    }

    function filter_match(row) {
        // The text in the search box
        var filterText;
        // Test to see if the row is on the left or right table
        if ($(row).parents('.tableDiv').is('#leftTable'))
            filterText = $('#leftSearch').val();
        else if ($(row).parents('.tableDiv').is('#rightTable'))
            filterText = $('#rightSearch').val();
        else
            console.log("Error, "+row+" belongs to neither table");

        var found = false;
        // Iterate over every cell of the row
        $(row).children('td').each(function(i, cell) {
            var regExp = new RegExp(filterText, 'i');
            // Is the search string found?
            if (regExp.test($(cell).text())) {
                found = true;
            }
        });

        if (found)
            return true
        else
            return false;
    }

    // Returns whether a row has a connection, have to do it based on monitor.connections
    // not arrows themselves
    function is_connected(row) {
        // What is the name of the signal/link?
        var name = $(row).children('.name').text();
        var linkConList = [];   // A list of all links or connections in 'devA>devB' form
        var srcNames = [];      // All source names as strings
        var destNames = [];     // All dest names as strings

        if (selectedTab == all_devices) {
            linkConList = model.links.keys();
        }
        else linkConList = model.connections.keys();

        for (var i in linkConList) {
            var sd = linkConList[i].split('>');
            srcNames[i] = sd[0];
            destNames[i] = sd[1];
        }

        for (var i in srcNames) {
            // Does the name match a string in the connections/links?
            if (srcNames[i] == name || destNames[i] == name)
                return true;
        }

        return false;
    }

    /* params are TR elements, one from each table */
    function create_arrow(src, dest, geometry, sel, muted) {
        var line = svgArea.path();
        var bidirectional = selectedTab == all_devices;

        line.border = svgArea.path();
        line.border.attr({
            "stroke": "blue",
            "fill": "none",
            "stroke-width": "10pt",
            "stroke-opacity": 0,
            "cursor": "pointer",
            "border": "1px solid blue"
        });

        var S = fullOffset(src);
        var D = fullOffset(dest);
        var frame = fullOffset($('#svgDiv')[0]);

        if (geometry & 1)
            var x1 = bidirectional ? 5 : 0;
        else
            var x1 = frame.width - bidirectional * 5;
        var y1 = S.top + S.height / 3 - frame.top;

        if ((geometry >> 2) & 1)
            var x2 = 5;
        else
            var x2 = frame.width - 5;
        var y2 = D.top + D.height / 1.5 - frame.top;

        var path = [["M", x1, y1],
                    ["C", frame.width / 2, y1, frame.width / 2, y2, x2, y2]];

        line.attr({"path": path});
        line.border.attr({"path": path});

        if (sel)
            line.node.classList.add('selected');
        if (muted)
            line.node.classList.add('muted');

        line.attr({
            "fill": "none",
            "stroke-width": "2px",
            "cursor": "pointer",
            "arrow-end": "classic-wide-long"
        });
        if (bidirectional)
            line.attr({"arrow-start": "classic-wide-long"});

        // So that the arrow remembers which rows it is attached to
        line.srcTr = src;
        line.destTr = dest;

        arrows.push(line);
        $('#container').trigger("updateConnectionProperties");

        // TODO move this with all the other UI handlers
        $(line.border.node).on('click', function(e) {

            var _src = $(src).children('.name').text();
            var _dst = $(dest).children('.name').text();


            // So that the arrow is deselected if both rows are selected
            // selected, so deselect it
            if ($(src).hasClass('trsel') && $(dest).hasClass('trsel')) {
                select_tr(src);
                select_tr(dest);
                line.node.classList.remove('selected');
                if (selectedTab != all_devices)
                    model.selectedConnections_removeConnection(_src, _dst);
            }

            // not selected, so select it
            else {
                if (! $(src).hasClass('trsel'))
                    select_tr(src);
                if (! $(dest).hasClass('trsel'))
                    select_tr(dest);
                line.node.classList.add('selected');
                if (selectedTab != all_devices)
                    model.selectedConnections_addConnection(_src, _dst);
            }
            $('#container').trigger("updateConnectionProperties");

            e.stopPropagation();
        });
    }

    function select_tab(tab) {
        selectedTab = tab.innerHTML;
        $(".tabsel").removeClass("tabsel");
        $(tab).addClass("tabsel");

        if (tab == tabDevices) {
            $('#svgTitle').text("Links");
            leftTable.set_headers(sourceDeviceHeaders);
            rightTable.set_headers(destinationDeviceHeaders);
            $('#saveLoadDiv').addClass('disabled');
        }
        else {
            $('#svgTitle').text("Connections");
            leftTable.set_headers(signalHeaders);
            rightTable.set_headers(signalHeaders);
            $('#saveLoadDiv').removeClass('disabled');
        }

        $('#svgTop').text('hide unconnected');
        $('#leftSearch, #rightSearch').val('');

        $('#container').trigger("tab", selectedTab);
        view.update_display();
    }

    function select_tr(tr) {
        if (!tr) return;

        var t = $(tr);
        var name = tr.firstChild.innerHTML.replace(/<wbr>/g,'');

        // Is the row on the left or right?
        var i = (t.parents('.displayTable')[0] == leftTable.table) ? 0 : (t.parents('.displayTable')[0] == rightTable.table) ? 1 : null;
        if (i==null)
            return;

        var l = null;
        if (selectLists[selectedTab])
            l = selectLists[selectedTab][i];
        else
            selectLists[selectedTab] = [null, null];
        if (!l)
            l = new Assoc();

        if (t.hasClass("trsel")) {
            t.removeClass("trsel");
            l.remove(name);
        } else {
            t.addClass("trsel");
            l.add(name, tr.parentNode);
        }

        if (i == 0) // Left table
            lastSelectedTr.left = tr;
        else if (i == 1)
            lastSelectedTr.right = tr;

        selectLists[selectedTab][i] = l;
        $('#container').trigger("updateConnectionProperties");
    }

    // For selecting multiple rows with the 'shift' key
    function full_select_tr(tr) {
        var targetTable = $(tr).parents('.tableDiv').attr('id') == 'leftTable' ? '#leftTable' : '#rightTable';
        var trStart = targetTable == '#leftTable' ? lastSelectedTr.left : lastSelectedTr.right;
        if (!trStart) {
            return;
        }

        var index1 = $(tr).index();
        var index2 = $(trStart).index();

        var startIndex = Math.min(index1, index2);
        var endIndex = Math.max(index1, index2);

        $(''+targetTable+' tbody tr').each(function(i, e) {
            if (i > startIndex && i < endIndex
                && !$(e).hasClass('invisible') && !$(e).hasClass('trsel')) {
                select_tr(e);
                $('#container').trigger("updateConnectionProperties");
            }
        });
    }

    function deselect_all() {
        $('tr.trsel', leftTable.table).each(function(i,e) {
            selectLists[selectedTab][0].remove(e.firstChild.innerHTML.replace(/<wbr>/g, ''));
            $(this).removeClass('trsel');
        });
        $('tr.trsel', rightTable.table).each(function(i,e) {
            selectLists[selectedTab][1].remove(e.firstChild.innerHTML.replace(/<wbr>/g, ''));
            $(this).removeClass('trsel');
        });
        lastSelectedTr.left = null;
        lastSelectedTr.right = null;
        update_arrows();
        model.selectedConnections_clearAll();
        $('#container').trigger("updateConnectionProperties");
    }

    function select_all() {
        deselect_all();
        for (var i in arrows) {
            // Test to see if those rows are already selected
            // (select_tr() just toggles selection)
            arrows[i].attr('stroke', 'red');
            if (! $(arrows[i].srcTr).hasClass('trsel'))
                select_tr(arrows[i].srcTr);
            if (! $(arrows[i].destTr).hasClass('trsel'))
                select_tr(arrows[i].destTr);
        }
    }

    function on_table_scroll() {
        if (selectedTab == all_devices) {
            // TODO: should check first to see if scroll was vertical
            update_links();
        }
        else
            update_connections();
    }

    function apply_selected(f) {
        $('tr.trsel', leftTable.table).each(
        function(i, e) {
            var left = e;
            $('tr.trsel', rightTable.table).each(
                function(i, e) {
                    var right = e;
                    f(left, right);
                });
        });
    }

    function apply_selected_pairs(f, list) {
        var L = $('.trsel', leftTable.table);
        var R = $('.trsel', rightTable.table);

        L.map(function() {
            var left = this;
            R.map(function() {
                var right = this;
                var key = left.firstChild.innerHTML.replace(/<wbr>/g, '')+'>'+right.firstChild.innerHTML.replace(/<wbr>/g, '');
                var v = list.get(key);
                if (v) {
                    f(left, right);
                }
            });
        });
    }

    function on_link(e) {
        function do_link(l, r) {
            $('#container').trigger("link", [l.firstChild.innerHTML, r.firstChild.innerHTML]);
        }
        apply_selected(do_link);
        e.stopPropagation();
    }

    function on_link_mouseup(e, start, end) {
        $('#container').trigger("link", [start.cells[0].textContent,
                                         end.cells[0].textContent]);
        e.stopPropagation();
    }

    function on_unlink(e) {
        var selected = get_selected_rows();
        var keys = model.links.keys();

        for (var k in keys) {
            var l = model.links.get(keys[k]);
            // check if src_name and dest_name are selected
            if (   selected.indexOf(l.src_name) >= 0
                && selected.indexOf(l.dest_name) >= 0)
                $('#container').trigger("unlink", [l.src_name, l.dest_name]);
        }
        e.stopPropagation();
    }

    function on_connect(e, args) {
        if (model.mKey) {
            args['muted'] = true;
        }
        function do_connect(l, r) {
            var sig1 = l.firstChild.innerHTML.replace(/<wbr>/g, '');
            var sig2 = r.firstChild.innerHTML.replace(/<wbr>/g, '');
            $('#container').trigger("connect", [sig1, sig2, args]);
        }
        apply_selected(do_connect);
        e.stopPropagation();
    }

    function on_connect_mouseup(e, start, end, args) {
        if (model.mKey) {
            args['muted'] = true;
        }
        $('#container').trigger("connect", [start.cells[0].textContent,
                                            end.cells[0].textContent, args]);
        e.stopPropagation();
    }

    function get_selected_rows() {
        var list = $('.trsel', leftTable.table);
        var vals = [];

        list.map(function() {
             var v = this.firstChild.innerHTML.replace(/<wbr>/g, '');
             vals.push(v);
        });

        list = $('.trsel', rightTable.table);
        list.map(function() {
             var v = this.firstChild.innerHTML.replace(/<wbr>/g, '');
             vals.push(v);
        });
        return vals;
    }

    function on_disconnect(e) {
        var selected = get_selected_rows();
        var keys = model.connections.keys();

        for (var k in keys) {
            var c = model.connections.get(keys[k]);
            // check if src_name and dest_name are selected
            if (   selected.indexOf(c.src_name) >= 0
                && selected.indexOf(c.dest_name) >= 0)
                $('#container').trigger("disconnect", [c.src_name, c.dest_name]);
        }
        e.stopPropagation();
    }

    function add_tabs() {
        $('#container').append(
            "<ul class='topTabs'>"+
                "<li id='allDevices'>"+all_devices+"</li>"+
            "</ul>");
        tabList = $('.topTabs')[0];
        tabDevices = $('#allDevices')[0];

        selectedTab = all_devices;
    }

    function add_title_bar() {
        $('#container').append(
            "<div id='titleSearchDiv'>"+
                "<h2 id='leftTitle' class='searchBar'>Sources</h2></li>"+
                "<input type='text' id='leftSearch' class='searchBar'></input></li>"+
                "<h2 id='svgTitle' class='searchBar'>Links</h2></li>"+
                "<h2 id='rightTitle' class='searchBar'>Destinations</h2></li>"+
                "<input type='text' id='rightSearch' class='searchBar'></input></li>"+
            "</div>");
        var $titleSearchDiv = $('<div id="titleSearchDiv"></div>');
    }

    function add_display_tables() {
        leftTable = new listTable('leftTable');
        rightTable = new listTable('rightTable');

        // Put the tables in the DOM
        leftTable.create_within($('#container')[0]);
        rightTable.create_within($('#container')[0]);

        leftTable.set_headers(['device', 'outputs', 'IP', 'port']);
        rightTable.set_headers(['device', 'input', 'IP', 'port']);

        $(leftTable.table).tablesorter({widgets: ['zebra']});
        $(rightTable.table).tablesorter({widgets: ['zebra']});
    }


    function add_svg_area() {
        $('#container').append(
            "<div id='svgDiv'>"+
                "<div id='svgTop'>hide unconnected</div>"+
            "</div>");

        svgArea = Raphael($('#svgDiv')[0], '100%', '100%');

    }

    function add_status_bar() {
        $('#container').append(
            "<table id='statusBar'>"+
                "<tr>"+
                    "<td class='status left'></td>"+
                    "<td class='status middle'></td>"+
                    "<td class='status right'></td>"+
                "</tr>"+
            "</table>");

        leftTable.footer = $("#statusBar .left")[0];
        rightTable.footer = $("#statusBar .right")[0];
    }

    function drawing_curve(sourceRow) {
        var self = this;
        this.sourceRow = sourceRow;
        this.targetRow;
        this.muted = false;
        var allow_self_link = selectedTab == all_devices;

        this.canvasWidth = $('#svgDiv').width();

        this.clamptorow = function(row) {
            var svgPos = fullOffset($('#svgDiv')[0]);
            var rowPos = fullOffset(row);
            var y = rowPos.top + rowPos.height/2 - svgPos.top;
            return y;
        };

        this.findrow = function (y) {
            // The upper position of the canvas (so that we can find the absolute position)
            var svgTop = $('#svgDiv').offset().top;

            // Left edge of the target table
            var ttleft = $(this.targetTable.tbody).offset().left + 5;

            // Closest table element (probably a <td> cell)
            var td = document.elementFromPoint(ttleft, svgTop + y);
            var row = $(td).parents('tr')[0];
            return row;
        };

        // Our bezier curve points
        this.path = [["M"], ["C"]];

        // Are we starting from the left or right table?
        this.sourceTable;
        this.targetTable;
        if ($(this.sourceRow).parents('.tableDiv').attr('id') == "leftTable") {
            this.sourceTable = leftTable;
            this.path[0][1] = 0; // Start the curve at left
        }
        else {
            this.sourceTable = rightTable;
            this.path[0][1] = this.canvasWidth; // Start the curve at right
        }

        // And in the middle of the starting row
        this.path[0][2] = this.clamptorow(this.sourceRow);

        // The actual line
        this.line = svgArea.path();
        this.line.attr({"stroke-width": "2px",
                        "arrow-end": "classic-wide-long"});

        this.update = function(moveEvent) {
            moveEvent.offsetX = moveEvent.pageX - $('#svgDiv').offset().left;
            moveEvent.offsetY = moveEvent.pageY - $('#svgDiv').offset().top;

            var target = moveEvent.currentTarget;
            var start = [this.path[0][1], this.path[0][2]];
            var end = [this.path[1][5], this.path[1][6]];
            var c1 = null;
            if (target.tagName == "svg") {
                end = [moveEvent.offsetX, moveEvent.offsetY];
                var absdiff = Math.abs(end[0] - start[0]);

                // get targetTable
                if (absdiff < this.canvasWidth/2)
                    this.targetTable = this.sourceTable;
                else if (this.sourceTable == leftTable)
                    this.targetTable = rightTable;
                else
                    this.targetTable = leftTable;

                // Within clamping range?
                if (absdiff < 50) {
                    // we can clamp to same side
                    var startRow = this.findrow(start[1]);
                    var clampRow = this.findrow(end[1]);
                    if (clampRow && (allow_self_link || clampRow != startRow)) {
                        if (this.sourceTable == this.targetTable)
                            end[0] = start[0];
                        else
                            end[0] = this.canvasWidth - start[0];
                        c1 = end[1];
                        end[1] = this.clamptorow(clampRow);
                        this.checkTarget(clampRow);
                    }
                    else
                        this.checkTarget(null);
                }
                else if (this.canvasWidth - absdiff < 50) {
                    var clampRow = this.findrow(end[1]);
                    if (clampRow) {
                        end[0] = this.canvasWidth - start[0];
                        c1 = end[1];
                        end[1] = this.clamptorow(clampRow);
                        this.checkTarget(clampRow);
                    }
                    else
                        this.checkTarget(null);
                }
                else
                    this.checkTarget(null);
            }
            // We're over a table row of the target table
            if ($(target).parents('tbody')[0] == this.targetTable.tbody) {
                var rowHeight = $(target).height();
                this.checkTarget(target);
                if (this.sourceTable == this.targetTable)
                    end[0] = start[0];
                else
                    end[0] = this.canvasWidth - start[0];
                end[1] = this.clamptorow(target);
            }
            this.path = get_bezier_path(start, end, c1, this.canvasWidth);
            this.line.attr({"path": this.path});
        };

        this.mouseup = function(mouseUpEvent) {
            if (selectedTab == all_devices)
                on_link_mouseup(mouseUpEvent, this.sourceRow, this.targetRow);
            else if (this.targetRow) {
                on_connect_mouseup(mouseUpEvent, this.sourceRow,
                                   this.targetRow, {'muted': this.muted});
            }
            $("*").off('.drawing');
            $(document).off('.drawing');
            self.line.remove();
        };

        // Check if we have a new target row, select it if necessary
        this.checkTarget = function(mousedOverRow) {
            if (this.targetRow != mousedOverRow) {
                if (this.targetRow != null) {
                    if (this.sourceRow != this.targetRow || !allow_self_link)
                        select_tr(this.targetRow);
                }

                this.targetRow = mousedOverRow;

                if (this.targetRow)
                    select_tr(this.targetRow);
            }
        };
    }

    // Finds a bezier curve between two points
    function get_bezier_path(start, end, controlEnd, width) {
        // 'Move to': (x0, y0), 'Control': (C1, C2, end)
        var path = [["M", start[0], start[1]], ["C"]];

        // x-coordinate of both control points
        path[1][1] = path[1][3] = width / 2;
        // y-coordinate of first control point
        if (start[0] == end[0] && start[1] == end[1]) {
            path[1][2] = start[1] + 40;
            if (controlEnd)
                path[1][4] = controlEnd - 40;
            else
                path[1][4] = end[1] - 40;
        }
        else {
            path[1][2] = start[1];
            // y-coordinate of second control point
            if (controlEnd)
                path[1][4] = controlEnd;
            else
                path[1][4] = end[1];
        }

        // Finally, the end points
        path[1][5] = end[0];
        path[1][6] = end[1];

        return path;
    }

    function drawing_handlers() {
        // Wait for a mousedown on either table
        // Handler is attached to table, but 'this' is the table row
        $('.displayTable').on('mousedown', 'tr', function(tableClick) {

            var sourceRow = this;

            // Cursor enters the canvas
            $('#svgDiv').one('mouseenter.drawing', function() {

                var curve = new drawing_curve(sourceRow);

                // Make sure only the proper row is selected
                deselect_all();
                select_tr(curve.sourceRow);
                $('#container').trigger("updateConnectionProperties");

                // Moving about the canvas
                $('svg, .displayTable tbody tr').on('mousemove.drawing',
                                                    function(moveEvent) {
                    curve.update(moveEvent);
                });

                $(document).one('mouseup.drawing', function(mouseUpEvent) {
                    curve.mouseup(mouseUpEvent);
                });

                $(document).on('keydown.drawing', function(keyPressEvent) {
                    if (selectedTab != all_devices && keyPressEvent.which == 77) {
                        // Change if the user is drawing a muted connection
                        if (curve.muted == true) {
                            curve.muted = false;
                            curve.line.node.classList.remove('muted');
                        }
                        else {
                            curve.muted = true;
                            curve.line.node.classList.add('muted');
                        }
                    }
                });

            });

            $(document).one('mouseup.drawing', function(mouseUpEvent) {
                $("*").off('.drawing');
                $(document).off('.drawing');
            });
        });
    }

    this.add_handlers = function() {
        $('#container').on('click.list', function() {
            deselect_all();
        });

        $('.displayTable tbody').on({
            mousedown: function(e) {
                if (e.shiftKey == true)    // For selecting multiple rows at once
                    full_select_tr(this);
                select_tr(this);
                update_arrows();
            },
            click: function(e) { e.stopPropagation(); }
        }, 'tr');

        // For redrawing arrows upon table sort
        $('.displayTable thead').on('click', 'th', function(e) {
            e.stopPropagation();
            $(this).parents(".displayTable").one('sortEnd', function() {
                update_arrows();
            });
        });

        // Various keyhandlers
        $('body').on('keydown.list', function(e) {
            if (e.which == 67) { // connect on 'c'
                if (selectedTab == all_devices)
                    on_link(e);
                else
                    on_connect(e);
            }
            else if (e.which == 8 || e.which == 46) { // disconnect on 'delete'
                // Prevent the browser from going back a page
                // but NOT if you're focus is an input and deleting text
                if (!$(':focus').is('input')) {
                    e.preventDefault();
                }
                if (selectedTab == all_devices)
                    on_unlink(e);
                else
                    on_disconnect(e);
                deselect_all();
            }
            else if (e.which == 65 && e.metaKey == true) { // Select all 'cmd+a'
                e.preventDefault();
                select_all();
            }
            else if (e.which == 9 && e.altKey == true) {
                // Tabbing like in google chrome 'alt-tab'
                e.preventDefault();
                var n_tabs = $('.topTabs li').length;
                var currentTabIndex = $('li.tabsel').index() + 1;
                var nextTabIndex;
                if (e.shiftKey == false) { // Tabbing forwards
                    if (currentTabIndex < n_tabs)
                        nextTabIndex = currentTabIndex + 1;
                    else // If we're at the last tab, select the first one
                        nextTabIndex = 1;
                }
                else {  // Tabbing backwards
                    if (currentTabIndex == 1) // At the first tab, go to the last
                        nextTabIndex = n_tabs;
                    else
                        nextTabIndex = currentTabIndex - 1;
                }
                select_tab($(tabList).children(':nth-child('+nextTabIndex+')')[0]);
            }
            else if ((e.which == 37 || e.which == 39)
                     && e.altKey == true && e.metaKey == true) {
                // Tabbing like in google chrome 'cmd-opt-left'
                e.preventDefault();
                var n_tabs = $('.topTabs li').length;
                var currentTabIndex = $('li.tabsel').index() + 1;
                var nextTabIndex;
                if (e.which == 39) { // Tabbing forwards
                    if (currentTabIndex < n_tabs)
                        nextTabIndex = currentTabIndex + 1;
                    else // If we're at the last tab, select the first one
                        nextTabIndex = 1;
                }
                else if (e.which == 37) {  // Tabbing backwards
                    if (currentTabIndex == 1) // At the first tab, go to the last
                        nextTabIndex = n_tabs;
                    else
                        nextTabIndex = currentTabIndex - 1;
                }
                select_tab($(tabList).children(':nth-child('+nextTabIndex+')')[0]);
            }
        });

        // The all devices tab
        $('#allDevices').on('click', function(e) {
            select_tab(tabDevices);
            e.stopPropagation();
        });

        // Search function boxes
        $('#leftSearch, #rightSearch').on('keyup', function(e) {
            e.stopPropagation();
            filter_view();
        });

        $('.tableDiv').on('scroll', function(e) {
            update_arrows();
        });

        $('#svgTop').on('click', function(e) {
            e.stopPropagation();
            if (view.unconnectedVisible == true) {
                view.unconnectedVisible = false;
                $('#svgTop').text('show unconnected');
            }
            else {
                view.unconnectedVisible = true;
                $('#svgTop').text('hide unconnected');
            }
            filter_view();
        });

        drawing_handlers();
    }
}
