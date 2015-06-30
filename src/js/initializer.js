$_('grapeTweet').module('Initializer', [], function(App, done){
    var Catalog= function(){
        this._listeners= [];
    };

    Catalog.checkListeners= function(){
        var object= this;
        this._listeners.forEach(function(item){
            if(item.event == 'available'){
                var ready= 0;
                item.listener.forEach(function(item){
                    if(Object.keys(object).indexOf(item) > -1)
                        ready++;
                });

                if(ready == item.listener.length){
                    item.success();
                }
            }
        });
    };

    Catalog.prototype.on= function(event, listener){
        var self= this;
        return new $$.Promise(function(success){
            self._listeners.push({ event : event, listener : listener, success : success });
            Catalog.checkListeners.apply(self);
        });
    };

    Catalog.prototype.add= function(key, value){
        this[key]= value;
        Catalog.checkListeners.apply(this);
    };

    var jobs= {};
    var finishedJobs= new Catalog();
    const LOG= true;

    var interface= {
        job : function(name, job){
            if(name in jobs){
                $$.console.error('initializor job "'+name+'" already exists!');
                return {};
            }

            jobs[name]= {
                job : job,
                dependencies : []
            };

            return {
                depends : function(){
                    jobs[name].dependencies= $$.Array.prototype.map.apply(arguments, [function(item){ return item; }]);
                    return interface;
                },

                job : interface.job,
                init : interface.init
            };
        },

        init : function(){
            if(LOG) $$.console.time('init');
            jobs= Object.keys(jobs).map(function(key){
                var item= jobs[key];

                return new $$.Promise(function(done){
                    var ready= function(){
                        if(LOG) $$.console.timeEnd(key);
                        finishedJobs.add(key, true);
                        done();
                    };

                    if(!item.dependencies.length){
                        if(LOG) $$.console.time(key);
                        item.job(ready);
                    }else{
                        finishedJobs.on('available', item.dependencies).then(function(){
                            if(LOG) $$.console.time(key);
                            item.job(ready);
                        });
                    }
                });
            });

            return $$.Promise.all(jobs).then(function(){
                if(LOG) $$.console.timeEnd('init');
            });
        }
    };

    done(interface);
});
