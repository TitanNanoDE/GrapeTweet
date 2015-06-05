$_('grapeTweet').module('Storage', [], function(App, ready){
	var db= null;
	var dbRequest= $$.indexedDB.open('grapeTweetDB', 1);
	var AsyncLoop= $('classes').AsyncLoop;

    var caches= {
        conversations : {},
        contacts : {}
    };

    var listeners= {
        messages : {

        },

        add : function(id, type, callback){
            var l= this[type][id]= this[type][id] || [];
            l.push(callback);
        },
        collect : function(type, id){
            var l= this[type][id];
            this[type][id]= [];
            return l || [];
        }
    };

    var StorePrototype= {
        methods : {
            save : function(){
                interface.saveStore(this);
            }
        },

        get : function(store, property){
            if(property in this.methods){
                return this.methods[property].bind(store);
            }else{
                return store[property];
            }
        },

        set : function(store, property, value){
            if(!this.methods[property]){
                store[property]= value;
            }
        }
    };

    var contactsCached= false;

    var getChunk= function(store, id, includeLast){
        return new $$.Promise(function(success){
            var list= [];
            var nextItem= id;

            (new AsyncLoop(function(next, exit){
                var request= db.transaction([store]).objectStore(store).get(nextItem);

                request.onsuccess= function(e){
                    var item= e.target.result;
                    if(item.last.split('@').length > 2){
                        var x= item.last.split('@');
                        x.pop();
                        item.last= x.join('@');
                    }
                    nextItem= item.last;

                    if(includeLast || item.id_str != id)
                        list.push(item);

                    if(nextItem !== null && list.length <= 20)
                        next();
                    else
                        exit();
                };

                request.onerror= exit;
            })).incalculable().then(function(){
                success(list);
            });
        });
    };

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
			var direct_messages= db.createObjectStore('direct_messages', { keyPath : 'id_str' });
            var tweets= db.createObjectStore('tweets', { keyPath : 'id_str' });
			db.createObjectStore('contacts', { keyPath : 'id' });
			db.createObjectStore('stores', { keyPath : 'name' });
            db.createObjectStore('timelines', { keyPath : 'id' });

			direct_messages.createIndex('recipient_id', 'recipient_id', { unique : false });
			direct_messages.createIndex('sender_id', 'sender_id', { unique : false });
			tweets.createIndex('timeline', 'timeline', { unique : false });
		}
	};

	var interface= {

//      classes
        Store : function(core){
            return new Proxy(core, StorePrototype);
        },

//		application states
		getStore : function(name){
			return new Promise(function(success, error){
				var request= db.transaction(['stores']).objectStore('stores').get(name);
				request.onsuccess= function(e){
					success(e.target.result || {});
				};

				request.onerror= error;
			});
		},

        getStores : function(){
            return new Promise(function(success, error){
                var list= [];
                var request= db.transaction(['stores']).objectStore('stores').openCursor();
                request.onsuccess= function(e){
                    if(e.target.result){
                        list.push(e.target.result.value);
                        e.target.result.continue();
                    }else{
                        success(list);
                    }
                };

                request.onerror= error;
            });
        },

		saveStore : function(store){
			return new Promise(function(success){
				var request= db.transaction(['stores'], 'readwrite').objectStore('stores').put(store);

				request.onsuccess= function(e){
					success(e.target.result);
				};

				request.onerror= function(){
					success(null);
				};
			});
		},

//		Direct Messages
		storeMessage : function(message){
			return new Promise(function(success, error){
				var request= db.transaction(['direct_messages'], 'readwrite').objectStore('direct_messages').put(message);

				request.onsuccess= function(e){
					success(e.target.result);
                    listeners.collect('messages', message.id_str).forEach(function(item){
                        if(item)
                            item(message);
                    });
				};

				request.onerror= error;
			});
		},

		getMessage : function(id, required){
			return new Promise(function(success, error){
				var request= db.transaction(['direct_messages']).objectStore('direct_messages').get(id);

				request.onsuccess= function(e){
					success(e.target.result);
				};

				request.onerror= function(e){
                    $$.console.log(e);
                    if(required){
                        listeners.add(id, 'messages', success);
                    }else{
                        error(e);
                    }
                };
			});
		},

		getMessagesChunkBefore : function(id, includeLast){
            return getChunk('direct_messages', id, includeLast);
		},

		getNewMessagesSince : function(id){
			return new Promise(function(success, error){
				var list= [];
				var nextMessage= null;

				var request= db.transaction(['direct_messages']).objectStore('direct_messages').get(id);

				request.onsuccess= function(e){
					nextMessage= e.target.result.next;

					if(nextMessage !== null){
						(new AsyncLoop(function(next, exit){
							var request= db.transaction(['direct_messages']).objectStore('direct_messages').get(nextMessage);

							request.onsuccess= function(e){
								var message= e.target.result;
								nextMessage= message.next;
								list.push(message);

								if(nextMessage !== null)
									next();
								else
									exit();
							};

							request.onerror= exit;
						})).incalculable().then(function(){
							success(list);
						});
					}else{
						success(list);
					}
				};

				request.onerror= error;
			});
		},

		checkDirectMessages : function(){
			return new Promise(function(done, error){
				var request= db.transaction(['direct_messages']).objectStore('direct_messages').openCursor();

				request.onsuccess= function(e){
					if(e.target.result)
						done(true);
					else
						done(false);
				};

				request.onerror= error;
			});
		},

//		contacts
		storeContact : function(contact){
			return new Promise(function(done, error){
                contact.id= String(contact.id);
                caches.contacts[contact.id]= contact;
				var request= db.transaction(['contacts'], 'readwrite').objectStore('contacts').put(contact);

				request.onsuccess= function(e){
					done(e.target.result);
				};

				request.onerror= function(e){
					error(e);
				};
			});
		},

		getContact : function(userId){
			return new Promise(function(success){
                userId= String(userId);

                if(!(userId in caches.contacts)){
				    var request= db.transaction(['contacts']).objectStore('contacts').get(userId);

				    request.onsuccess= function(e){
                        caches[userId]= e.target.result;
                        success(e.target.result);
				    };

				    request.onerror= function(){
                        success(null);
				    };
                }else{
                    success(caches.contacts[userId]);
                }
			});
		},

		getContacts : function(){
			return new Promise(function(done, error){
				if(!contactsCached){
                    var request= db.transaction(['contacts']).objectStore('contacts').openCursor();

				    request.onsuccess= function(e){
                        var cursor= e.target.result;

                        if(cursor){
                            if(!(cursor.key in caches.contacts))
                                caches.contacts[cursor.key]= cursor.value;
                            cursor.continue();
                        }else{
                            contactsCached= true;
                            done(caches.contacts);
                        }
                    };

                    request.onerror= function(e){
                        error(e);
				    };
                }else{
                    done(caches.contacts);
                }
			});
		},

//      tweets and timelines
        storeTimeline : function(timeline){
            return new $$.Promise(function(done, error){
                var request= db.transaction(['timelines'], 'readwrite').objectStore('timelines').put(timeline);

                request.onsuccess= function(e){
                    done(e.target.result);
                };

                request.onerror= function(e){
                    error(e);
                };
            });
        },

        getTimeline : function(id){
			return new $$.Promise(function(success){
                var request= db.transaction(['timelines']).objectStore('timelines').get(id);

                request.onsuccess= function(e){
                    success(e.target.result);
                };

                request.onerror= function(){
                    success(null);
                };
			});
		},

        storeTweet : function(tweet, timeline){
            return new $$.Promise(function(done, error){
                tweet= JSON.parse(JSON.stringify(tweet));
                tweet.id_str+= '@'+timeline.id;
                tweet.last+= '@'+timeline.id;
                if(tweet.next !== null) tweet.next+= '@'+timeline.id;
                var request= db.transaction(['tweets'], 'readwrite').objectStore('tweets').put(tweet);

                request.onsuccess= function(e){
                    done(e.target.result);
                };

                request.onerror= function(e){
                    error(e);
                };
            });
        },

        getTweet : function(id, timeline){
            return new $$.Promise(function(done, error){
                var request= db.transaction(['tweets']).objectStore('tweets').get(id+'@'+timeline);

                request.onsuccess= function(e){
                    var tweet= e.target.result;
                    tweet.id_str= tweet.id_str.split('@')[0];
                    tweet.last= tweet.last.split('@')[0];
                    tweet.next= (tweet.next !== null) ? tweet.next.split('@')[0] : tweet.next;
                    done(tweet);
                };

                request.onerror= function(e){
                    error(e);
                };
            });
        },

        getTweetsChunkBefore : function(id, timeline, includeLast){
            return getChunk('tweets', id+'@'+timeline.id, includeLast).then(function(chunck){
                chunck.forEach(function(item){
                    item.id_str= item.id_str.split('@')[0];
                });
                return chunck;
            });
		},
	};
});
