function LibMapperModel() {
    this.devices = new Assoc();
    this.signals = new Assoc();
    this.links = new Assoc();
    this.connections = new Assoc();
    this.selectedLinks = new Assoc();
    this.selectedConnections = new Assoc();

    this.networkInterfaces = {'selected': null, 'available': []};

    // config items
    this.pathToImages = "images/";
};

LibMapperModel.prototype = {
    // returns an ARRAY with the selected connections
    getSelectedConnections : function() {
        var result = new Array();
        var k = this.selectedConnections.keys();
        for (var key in k)
            result.push(this.selectedConnections.get(k));
        return result;
    },

    selectedConnections_toggleConnection : function(src, dst) {
        // no polymorphism in JS... arrg!
        // called with no 'dst' if the full key is passed in src
        var key = src;
        if (dst != null)
            key += ">" + dst;

        var conn = this.connections.get(key);
        if (conn) {
            if (!this.selectedConnections.get(key)) {
                this.selectedConnections.add(key, conn);
                return 1;
            }
            else
                this.selectedConnections.remove(key);
        }
        return 0;
    },

    selectedConnections_removeConnection : function(src, dst) {
        var key = src + ">" + dst;
        if (this.selectedConnections.get(key)) {
            this.selectedConnections.remove(key);
            console.log(this.selectedConnections.keys());
        }
    },

    selectedConnections_isSelected : function(src, dst) {
        var key = src + ">" + dst;
        var conn = this.selectedConnections.get(key);
        if (conn)
            return true;
        else
            return false;
    },

    selectedConnections_clearAll : function() {
        this.selectedConnections = new Assoc();
    },

    getConnection : function(src, dst) {
        var key = src + ">" + dst;
        return this.connections.get(key);
    },

    selectedLinks_toggleLink : function(src, dst) {
        // no polymorphism in JS... arrg!
        // called with no 'dst' if the full key is passed in src
        var key = src;
        if (dst != null)
            key += ">" + dst;

        var link = this.links.get(key);
        if (link) {
            if (!this.selectedLinks.get(key)) {
                this.selectedLinks.add(key, link);
                return 1;
            }
            else
                this.selectedLinks.remove(key);
        }
        return 0;
    },

    selectedLinks_clearAll : function() {
        this.selectedLinks = new Assoc();
    },

    isConnected : function(src, dst) {
        var conn = this.getConnection(src, dst);
        if (conn)
            return true;
        return false;
    },

    getLink : function(src, dst) {
        if (src < dest)
            var key = src + ">" + dst;
        else
            var key = dst + ">" + src;
        return this.links.get(key);
    },

    isLinked : function(src, dst) {
        if (src && dst) {
            var link = this.getLink(src, dst);
            if (link)
                return true;
        }
        else if (src) {
            // check all links
            var keypart = src + ">";
            var links = this.links.keys();
            for (var d in links) {
                var k = links[d];
                if (k.search(keypart) == 0)
                    return true;
            }
        }
        return false;
    },

    // returns devices split into sources and destinations
    getDevices : function() {
        var srcDevs = new Array();
        var dstDevs = new Array();

        var keys = this.devices.keys();
        for (var d in keys) {
            var k = keys[d];
            var dev = this.devices.get(k);

            if (dev.num_outputs)
                srcDevs.push(dev);
            if (dev.num_inputs)
                dstDevs.push(dev);
        }
        return [srcDevs, dstDevs];
    }
};