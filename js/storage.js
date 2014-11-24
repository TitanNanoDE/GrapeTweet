$_('grapeTweet').module('Storage', [], function(App, ready){
	var db= null;
	var dbRequest= $$.indexedDB.open('grapeTweetDB', 1);
	var AsyncLoop= $('classes').AsyncLoop;
	
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
			db.createObjectStore('contacts', { keyPath : 'id' });
			db.createObjectStore('applicationStates', { keyPath : 'name' });
			var tweets= db.createObjectStore('tweets', { keyPath : 'id_str' });
			db.createObjectStore('conversations', { keyPath : 'id' });
            db.createObjectStore('timelines', { keyPath : 'id' });
			 
			direct_messages.createIndex('recipient_id', 'recipient_id', { unique : false });
			direct_messages.createIndex('sender_id', 'sender_id', { unique : false });
			tweets.createIndex('timeline', 'timeline', { unique : false });
		}
	};
	
	var interface= {

//		application states
		getApplicationState : function(name){
			return new Promise(function(success, error){
				var request= db.transaction(['applicationStates']).objectStore('applicationStates').get(name);
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= error;
			});
		},
		
		saveApplicationState : function(state){
			return new Promise(function(success){
				var request= db.transaction(['applicationStates'], 'readwrite').objectStore('applicationStates').put(state);
				
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= function(){
					success(null);
				};
			});
		},
		
//		Direct Messages
		getConversation : function(userId){
			return new Promise(function(success){
				var request= db.transaction(['conversations']).objectStore('conversations').get(String(userId));
				
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= function(){
					success(null);
				};
			});	
		},
		
		storeConversation : function(conv){
			return new Promise(function(success, error){
				var request= db.transaction(['conversations'], 'readwrite').objectStore('conversations').put(conv);
				
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= error;
			});
		},
		
		storeMessage : function(message){
			return new Promise(function(success, error){
				var request= db.transaction(['direct_messages'], 'readwrite').objectStore('direct_messages').put(message);
			
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= error;
			});
		},
		
		getMessage : function(id){
			return new Promise(function(success, error){
				var request= db.transaction(['direct_messages']).objectStore('direct_messages').get(id);
				
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= error;
			});
		},
		
		getMessagesChunkBefore : function(id, include){
			return new Promise(function(success){
				var list= [];
				var nextMessage= id;
				
				(new AsyncLoop(function(next, exit){
					var request= db.transaction(['direct_messages']).objectStore('direct_messages').get(nextMessage);
					
					request.onsuccess= function(e){
						var message= e.target.result;
						nextMessage= message.last;
						
						if(include || message.id_str != id)
							list.push(message);
						
						if(nextMessage !== null && list.length <= 20)
							next();
						else
							exit();
					};
					
					request.onerror= exit;
				})).incalculable().then(function(){
					success(list);
				});
			});
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
		
		getConversationsList : function(){
			return new Promise(function(done, error){
				var request= db.transaction(['conversations']).objectStore('conversations').openCursor();
				var conversations= {};
				
				request.onsuccess= function(e){
					var cursor= e.target.result;
					
					if(cursor){
						conversations[cursor.key]= cursor.value;
						cursor.continue();
					}else
						done(conversations);
				};
				
				request.onerror= error;
			});
		},
		
//		contacts
		storeContact : function(contact){
			return new Promise(function(done, error){
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
				userId= $$.parseInt(userId);
				var request= db.transaction(['contacts']).objectStore('contacts').get(userId);
				
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= function(){
					success(null);	
				};
			});
		},
		
		getContacts : function(){
			return new Promise(function(done, error){
				var list= {};
				var request= db.transaction(['contacts']).objectStore('contacts').openCursor();
				
				request.onsuccess= function(e){
					var cursor= e.target.result;
					
					if(cursor){
						list[cursor.value.id]= cursor.value;
						cursor.continue();
					}else
						done(list);
				};
				
				request.onerror= function(e){
					error(e);
				};
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
        
        storeTweet : function(tweet, timeline){
            return new $$.Promise(function(done, error){
                tweet.id+= '@'+timeline;
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
                    tweet.id= tweet.id.split('@')[0];
                    done(tweet);
                };
                
                request.onerror= function(e){
                    error(e);
                };
            });
        }
	};
});