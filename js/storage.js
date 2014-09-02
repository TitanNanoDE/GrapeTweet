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
			return new Promise(function(success, error){
				var request= db.transaction(['applicationStates'], 'readwrite').objectStore('applicationStates').put(state);
				
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= error;
			});
		},
		
		getConversation : function(userId){
			return new Promise(function(success, error){
				var request= db.transaction(['direct_messages']).objectStore('direct_messages').index('sender_id').openCursor(userId);
				var items= [];
				
				request.onsuccess= function(e){
					var cursor= e.target.result;
					
					if(cursor)
						items.push(cursor.value);
					else
						success(items);
				};
				
				request.onerror= error;
			});	
		},
		
		storeMessage : function(message){
			return new Promise(function(success, error){
				var request= db.transaction(['direct_messages']).objectStore('direct_messages').add(message);
			
				request.onsuccess= function(e){
					success(e.target.result);
				};
				
				request.onerror= error;
			});
		}
	};
});