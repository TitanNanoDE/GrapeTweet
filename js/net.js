$_('grapeTweet').module('net', function(done){
	
	var AsyncLoop= $('classes').AsyncLoop;

	done({
		downloadDirectMessages : function(app){
			return new $$.Promise(function(done){
				var max_id_in= 0;
				var max_id_out= 0;
			
				var loopIn= new AsyncLoop(function(next, exit){
					var request= null;

					if(max_id_in === 0)
						request= app.twitterSocket.get('/1.1/direct_messages.json', { count : 200 });
					else
						request= app.twitterSocket.get('/1.1/direct_messages.json', { max_id : max_id_in, count : 200 });
      	
					request.then(function(data){
						data= $$.JSON.parse(data);
						
						if(max_id_in !== 0)
							data.shift();
					
						if(data.length === 0)
							return exit();
				
						data.forEach(function(item){
							delete item.recipient;
							delete item.sender;
          
							if(!app.account.conversations[item.sender_id])
								app.account.conversations[item.sender_id]= [];
					
							if(app.dataStatus.lastDM_in === '')
								app.dataStatus.lastDM_in= item.id_str;
					
							app.account.conversations[item.sender_id].push(item);	
							max_id_in= item.id_str;
						});
					
						next();
					});
					
					request.catch(exit);
				});
			
				var loopOut= new AsyncLoop(function(next, exit){
					var request= null;
					
					if(max_id_out === 0)
						request= app.twitterSocket.get('/1.1/direct_messages/sent.json', { count : 200 });
					else
						request= app.twitterSocket.get('/1.1/direct_messages/sent.json', { max_id : max_id_out, count : 200 });
      		
					request.then(function(data){
						data= $$.JSON.parse(data);
					
						if(max_id_out !== 0)
							data.shift();
					
						if(data.length === 0)
							return exit();
					
						data.forEach(function(item){
							delete item.recipient;
							delete item.sender;
          	
							if(!app.account.conversations[item.recipient_id])
								app.account.conversations[item.recipient_id]= [];
						
							if(app.dataStatus.lastDM_out === '')
								app.dataStatus.lastDM_out= item.id_str;
					
							app.account.conversations[item.recipient_id].push(item);	
							max_id_out= item.id_str;
						});
					
						next();
					});
					
					request.catch(exit);
				});
			
				$$.Promise.all([loopIn.incalculable(), loopOut.incalculable()]).then(function(){
					var convs= app.account.conversations;
				
//					sort messages
					$$.Object.keys(convs).forEach(function(item){
						var current= convs[item];
						
						current= current.sort(function(a, b){
							return (( (new $$.Date(a.created_at)).getTime() > (new $$.Date(b.created_at)).getTime() ) ? 1 : -1);
						});
					});
					done();
				});
			});
		},
		
		syncContacts : function(app){
    		return new $$.Promise(function(success){
				$$.Promise.all([app.twitterSocket.get('/1.1/friends/ids.json', { user_id : app.account.userId }), app.twitterSocket.get('/1.1/followers/ids.json', { user_id : app.account.userId })]).then(function(values){
					var following= $$.JSON.parse(values[0]).ids;
					var follower= $$.JSON.parse(values[1]).ids;
					var contacts= [];
					var getList= [];
					var idList= [];
        
//      			isolating contacts
					if(following.length == Math.min(following.length, follower.length)){
						following.forEach(function(item){
							if(follower.indexOf(item) > -1)
								contacts.push(item);
						});
					}else{
						follower.forEach(function(item){
							if(following.indexOf(item) > -1)
								contacts.push(item);
						});
					}
        	
//  		    	loading contacts infos
					var i= 0;
					while(i < contacts.length){
						if(idList.length < 100){
							idList.push(contacts[i]);
						}else{
							getList.push(app.twitterSocket.get('/1.1/users/lookup.json', { user_id : idList.join(','), include_entities : false }));
							idList= [];
							idList.push(contacts[i]);
						}
						i++;
					}
        
					if(idList.length > 0)
						getList.push(app.twitterSocket.get('/1.1/users/lookup.json', { user_id : idList.join(','), include_entities : false }));
        	
					$$.Promise.all(getList).then(function(values){
						var contactsInfos= [];
          	
						values.forEach(function(item){
							contactsInfos= contactsInfos.concat($$.JSON.parse(item));
						});
          	
						contactsInfos.forEach(function(item){
							app.account.contacts[item.id]= item;
						});
						
//  		    	  	done, all contacts loaded
						success();
					});
				});
			});	
		},
		
		cacheImage : function(url, app){
			return new Promise(function(done){
				if(app.cache.images[url])
					done(app.cache.images[url]);
				else{
					app.twitterSocket.download(url, true).then(function(blob){
						var blob_url= $$.URL.createObjectURL(blob);
						app.cache.images[url]= blob_url;
						done(blob_url);
					});
				}
			});
		}
	});
});