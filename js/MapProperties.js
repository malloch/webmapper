class MapProperties {
    constructor(container, graph, view) {
        this.container = container;
        this.graph = graph;
        this.view = view;
        this.mapModeCommands = {"Linear": 'linear', "Expression": 'expression' };
        this.mapModes = ["Linear", "Expression"];
        this.mapProtocols = ["UDP", "TCP"];

        $(this.container).append(
            "<div' class='topMenu' style='width:calc(100% - 324px);'>"+
                "<div id='mapPropsTitle' class='topMenuTitle'><strong>MAP</strong></div>"+
                "<div id='mapPropsDiv' style='position:absolute;left:0px;top:20px;width:100%;height:100%;'></div>"+
            "</div>");

        $('#mapPropsDiv').append(
            "<div class='topMenuContainer' style='width:190px;height:100%;'>"+
                "<div id='protocols' class='signalControl disabled'>Protocol: </div>"+
                "<div id='modes' class='signalControl disabled'>Mode: </div>"+
            "</div>"+
            "<div id='expression' class='signalControl disabled' style='position:absolute;width:calc(100% - 200px);left:200px;top:-20px;height:100%;padding:5px;'>"+
                "<textarea id='expression 'class='expression' style='width:50%;height:100%;resize:none;float:left;'></textarea>"+
                "<table id='literals' style='width:50%;'><tbody></tbody></table>"+
            "</div>"+
            "<div class='hidden' id='ranges' style='position:absolute;top:-20px;width:calc(100% - 200px);padding:5px;'></div>");
        
        //Add the mode controls
        for (var m in this.mapModes) {
            $('#modes').append(
                "<div class='mode' id='mode"+this.mapModes[m]+"'>"+this.mapModes[m]+"</div>");
        }

        //Add the protocol controls
        for (var p in this.mapProtocols) {
            $('#protocols').append(
                "<div class='protocol' id='proto"+this.mapProtocols[p]+"'>"+this.mapProtocols[p]+"</div>");
        }

        //Add the range controls
        $('#ranges').append(
            "<div id='srcRange' class='range signalControl disabled'>"+
                "<div style='width:80px'>Src Range:</div>"+
                "<div style='width:calc(100% - 120px)'>"+
                    "<input class='range' id='src_min' style='width:calc(50% - 14px)'></input>"+
                    "<div id='srcRangeSwitch' class='rangeSwitch'></div>"+
                    "<input class='range' id='src_max' style='width:calc(50% - 14px)'></input>"+
                "</div>"+
                "<div id='setLinear' class='setlinear'>Linear</div>"+
            "</div>"+
            "<div id='dstRange' class='range signalControl disabled'>"+
                "<div style='width:80px'>Dest Range:</div>"+
                "<div style='width:calc(100% - 120px)'>"+
                    "<input class='range' id='dst_min' style='width:calc(50% - 14px)'></input>"+
                    "<div id='dstRangeSwitch' class='rangeSwitch'></div>"+
                    "<input class='range' id='dst_max' style='width:calc(50% - 14px)'></input>"+
                "</div>"+
                "<div id='srcCalibrate' class='calibrate'>Calib</div>"+
            "</div>");

        this._addHandlers();
    }

    _addHandlers() {
        var self = this;
        var counter = 0;

        $('#networkSelection').on('change', function(e) {
            command.send("select_network", e.currentTarget.value);
        });

        // The range input handler
        $('.topMenu').on({
            keydown: function(e) {
                e.stopPropagation();
                if (e.which == 13 || e.which == 9) { //'enter' or 'tab' key
                    self.setMapProperty($(this).attr('id').split(' ')[0],
                                         this.value);
                }
            },
            click: function(e) { e.stopPropagation(); },
            focusout: function(e) {
                e.stopPropagation();
                self.setMapProperty($(this).attr('id').split(' ')[0],
                                    this.value);
            },
        }, 'input');

        // The expression input handler
        $('.topMenu').on({
            keydown: function(e) {
                e.stopPropagation();
                if (e.which == 13) { //'enter' key
                    if (counter >= 1) {
                        console.log('sending updated expression');
                        self.setMapProperty($(this).attr('id').split(' ')[0],
                                            this.value);
                         counter = 0;
                    }
                    else
                        counter += 1;
                }
                else
                    counter = 0;
            },
            click: function(e) { e.stopPropagation(); },
            focusout: function(e) {
                e.stopPropagation();
                self.setMapProperty($(this).attr('id').split(' ')[0],
                                    this.value);
            },
        }, 'textarea');

        //For the mode buttons
        $('.topMenu').on("click", '.mode', function(e) {
            e.stopPropagation();
            self.setMapProperty("mode", e.currentTarget.innerHTML);
        });

        $('.topMenu').on("click", '.protocol', function(e) {
            e.stopPropagation();
            self.setMapProperty("protocol", e.currentTarget.innerHTML);
        });

        $('.rangeSwitch').click(function(e) {
            e.stopPropagation();
            self.setMapProperty(e.currentTarget.id, null);
        });

        $('.calibrate').click(function(e) {
            e.stopPropagation();
            self.setMapProperty(e.currentTarget.id, null);
        });

        $('body').on('keydown', function(e) {
            if (e.which == 77)
                self.setMapProperty("muted", null);
        });

        $('.expr_doc_link').click(function(e) {
            // show expression documentation
            $('#status').stop(true, false)
                        .empty()
                        .load('./doc/expression_syntax.html')
                        .css({'left': '20%',
                              'top': 70,
                              'width': '60%',
                              'height': 'calc(100% - 90px)',
                              'opacity': 0.9});
        });
    }

    // clears and disables the map properties bar
    clearMapProperties() {
        $('.mode').removeClass('sel');
        $('.protocol').removeClass('sel');
        $('.topMenu .range').val('');
        $('.topMenu textarea').val('');
        $('.signalControl').children('*').removeClass('disabled');
        $('.signalControl').addClass('disabled');
        $('#mapPropsTitle').addClass('disabled');
        $('.expression').removeClass('waiting');
    }

    selected(map) {
        return map.selected;
    }

    updateMapProperties() {
        this.clearMapProperties();

        var proto = null;
        var expression = null;
        var vars = {};

        let selected = this.graph.maps.filter(m => m.selected);
        console.log('selected:', selected.size(), selected);

        if (selected && selected.size()) {
            // something has been selected
            $('#mapPropsTitle').removeClass('disabled');
            $('.signalControl').removeClass('disabled');
            $('.signalControl').children('*').removeClass('disabled');
        }
        else
            return;

        selected.each(function(map) {
            if (proto == null)
                proto = map.protocol;
            else if (proto != map.protocol)
                proto = 'multiple';
            if (expression == null)
                expression = map.expr;
            else if (expression != map.expr)
                expression = 'multiple expressions';

            for (let prop in map) {
                if (!map.hasOwnProperty(prop))
                    continue;
                if (!prop.startsWith("var@"))
                    continue;
                let key = prop.slice(4);
                if (vars[key] == undefined)
                    vars[key] = map[prop];
                else
                    vars[key] = 'multiple values';
            }
        });

        if (proto != null && proto != 'multiple') {
            $("#proto"+proto).addClass("sel");
        }

        if (expression != null) {
            $(".expression").removeClass('waiting');
            expression = expression.replace(/;;/, '');
            expression = expression.replace(/;/g, ';\n');
            $(".expression").val(expression);
            if (expression == 'multiple expressions')
                $(".expression").css({'font-style': 'italic'});
            else
                $(".expression").css({'font-style': 'normal'});
        }

        console.log('adding vars:', vars);
        let literals = $("#literals");
        literals.empty();
        for (let key in vars) {
            literals.append("<tr><td>"+key+": "+vars[key]+"</td></tr>");
        }
    }

    // object with arguments for the map
    updateMapPropertiesFor(key) {
        // check if map is selected
        var map = this.graph.maps.find(key);
        if (this.selected(map))
            this.updateMapProperties();
    }

    setMapProperty(key, value) {
        let container = $(this.container);
        let modes = this.mapModeCommands;
        this.graph.maps.filter(this.selected).each(function(map) {
            if (map[key] && (map[key] == value || map[key] == parseFloat(value)))
                return;

            var msg = {};

            // set the property being modified
            switch (key) {
            case 'protocol':
                msg['protocol'] = value;
                break;
            case 'srcCalibrate':
                msg['src_calibrating'] = !map.src_calibrating;
                break;
            case 'muted':
                msg['muted'] = !map['muted'];
                break;
            case 'expression':
                value = value.replace(/\r?\n|\r/g, '');
                if (value == map.expression)
                    return;
                msg['expression'] = value;
                $(".expression").addClass('waiting');
                break;
            default:
                msg[key] = value;
            }

            // copy src and dst names
            msg['srcs'] = []
            for (let s of map.srcs) msg['srcs'].push(s.key);
            msg['dst'] = map['dst'].key;

            // send the command, should receive a /mapped message after.
            console.log('sending set_map', msg);
            command.send("set_map", msg);
        });
    }

    on_load() {
        var self = this;

        //A quick fix for now to get #container out of the way of the load dialogs
        var body = document.getElementsByTagName('body')[0];
        var iframe = document.createElement('iframe');
        iframe.name = 'file_upload';
        iframe.style.visibility = 'hidden';
        body.appendChild(iframe);

        var form = document.createElement('form');
        form.innerHTML = '<input id="file" type="file"                   \
                           name="mapping_json" size="40" accept="json">  \
                          <input type="submit" style="display: none;">   \
                          <input type="button" value="Cancel" id="cancel">';
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = '/load';
        form.target = 'file_upload';

        var l = document.createElement('li');
        l.appendChild(form);
        $('.topMenu').append(l);

        iframe.onload = function() {
//            var t = $(iframe.contentDocument.body).text();
//            if (t.search('Success:') == -1 && t.search('Error:') == -1)
//                return;
            self.notify($(iframe.contentDocument.body).text());
            $(l).remove();
            body.removeChild(iframe);
        };

        $('#cancel', form).click(function() {
            $(l).remove();
            $('#container').removeClass('onLoad');
            body.removeChild(iframe);
        });

        form.firstChild.onchange = function() {

            var fn = document.createElement('input');
            fn.type = 'hidden';
            fn.name = 'filename';
            fn.value = form.firstChild.value;
            form.appendChild(fn);

            // The devices currently in focused
            var devs = self.view.get_focused_devices();

            // Split them into sources and destinations
            var srcdevs = [];
            var dstdevs = [];
            this.graph.devices.each(function(dev) {
                if (devs.includes(dev.name)) {
                    if (dev.num_sigs_out)
                        srcdevs.push(dev.name);
                    if (dev.num_sigs_in)
                        dstdevs.push(dev.name);
                }
            });

            // So that the monitor can see which devices are being looked at
            var srcs = document.createElement('input');
            srcs.type = 'hidden';
            srcs.name = 'sources';
            srcs.value = srcdevs.join();
            form.appendChild(srcs);

            var dsts = document.createElement('input');
            dsts.type = 'hidden';
            dsts.name = 'destinations';
            dsts.value = dstdevs.join();
            form.appendChild(dsts);

            form.submit();
        };
        return false;
    }

    notify(msg) {
        var li = document.createElement('li');
        li.className = 'notification';
        li.innerHTML = msg;
        $('.topMenu').append(li);
        setTimeout(function() {
            $(li).fadeOut('slow', function() { $(li).remove();});
        }, 5000);
    }

    /**
     * Updates the save/loading functions based on the view's state
     * currently set up for the list view only
     */
    updateSaveLocation(location) {
        // get the save location
        if (location) {
            window.saveLocation = location;
        }
        else {
            window.saveLocation = '';
        }

        // update the save button's link
        $('#saveButton').attr('href', window.saveLocation);

        // if saving is not ready, disable the save button
        if (window.saveLocation == '') {
            $('#saveButton, #loadButton').addClass('disabled');
        }
        // if saving is ready, enable the save button
        else {
            $('#saveButton, #loadButton').removeClass('disabled');
        }
    }
}
