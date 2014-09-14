$_('grapeTweet').module('storage', function(ready){
	var db= null;
	var dbRequest= $$.indexedDB.open('grapeTweetDB', 1);
	
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
			return new Promise(function(success, error){
				var count= 0;
				var from= db.transaction(['direct_messages']).objectStore('direct_messages').index('sender_id').openCursor();
				var to= db.transaction(['direct_messages']).objectStore('direct_messages').index('recipient_id').openCursor();
				var items= [];
				
				var done= function(){
					count++;
					if(count == 2)
						success(items);
				};
				
				var onsuccess= function(e){
					var cursor= e.target.result;
					
					if(cursor){
						if(cursor.key == userId){
							items.push(cursor.value);
						}
						cursor.continue();
					}else
						done();
				};
					
				to.onsuccess= onsuccess;
				from.onsuccess= onsuccess;
				
				from.onerror= to.error= error;
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
		
		getConversationsList : function(userId){
			return new Promise(function(done, error){
				var request= db.transaction(['direct_messages']).objectStore('direct_messages').openCursor();
				var conversations= [];
				
				request.onsuccess= function(e){
					var cursor= e.target.result;
					
					if(cursor){
						if(cursor.value.sender_id != userId && conversations.indexOf(cursor.value.sender_id) < 0)
							conversations.push(cursor.value.sender_id);
						else if(cursor.value.recipient_id != userId && conversations.indexOf(cursor.value.recipient_id) < 0)
							conversations.push(cursor.value.recipient_id);
						cursor.continue();
					}else
						done(conversations);
				};
				
				request.onerror= function(e){
					error(e);
				};
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
		}
	};
});