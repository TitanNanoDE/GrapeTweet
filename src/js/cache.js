$_('grapeTweet').module('Cache', [], function(App, ready){
	var db= null;
	var dbRequest= $$.indexedDB.open('cacheDB', 1);

    dbRequest.onerror= function(){
		$$.console.error('unable to access the DB!');
	};

	dbRequest.onsuccess= function(){
		db= dbRequest.result;
		ready(interface);
	};

	dbRequest.onupgradeneeded= function(e){
		var db= e.target.result;

		if(e.oldVersion < 1){
			db.createObjectStore('files', { keyPath : 'url' });
		}
	};

    $('service').setEngine('af/af.js');
    $('service').new('cacheWorker');

    var interface= {
        save : function(url, blob, disc){
            return new Promise(function(success, error){
                var listen= function(request){
                    request.onsuccess= function(e){
                        success(e.target.result);
				    };

				    request.onerror= function(){
                        error(null);
				    };
                };

                if(!disc){
                    listen(db.transaction(['files'], 'readwrite').objectStore('files').put({ url : url, blob : blob, disc : disc }));
                }else{
                    var sdcard= $$.navigator.getDeviceStorage('sdcard');
                    var fileName= 'GrapeTweet/'+url.split('/').last();
                    var request= sdcard.addName(blob, fileName);

                    request.onsucess= function(){
                        listen(db.transaction(['files'], 'readwrite').objectStore('files').put({ url : url, fileName : this.result.name, storage : sdcard.storageName, disc : disc }));
                        $$.console.log('saved', sdcard.storageName, this.result.name);
                    };

                    request.onerror= function(){
                        $$.console.error('faild to save', sdcard.storageName, fileName, this.error);
                        $$.alert('faild to save file!');
                        error(null);
                    };
                }
			});
       },

       recover : function(url){
            return new $$.Promise(function(success, error){
                var request= db.transaction(['files']).objectStore('files').get(url);
                request.onsuccess= function(e){
                    if(e.target.result.disc){
                        var sdcard= $$.navigator.getDeviceStorages('sdcard').find(function(item){ if(item.storageName == e.target.result.storage) return 1; });
                        var request= sdcard.get(e.target.result.fileName);
                        request.onsuccess= function(){
                            success(this.result);
                        };
                        request.onerror= function(){
                            $$.console.error('faild to open file', sdcard.storageName, e.target.result.fileName, this.error);
                            $$.alert('faild to open file!');
                            error(null);
                        };
                    }else{
                        success(e.target.result.blob);
                    }
				};
				request.onerror= function(){
					error(null);
				};
			});
       }
   };
});
