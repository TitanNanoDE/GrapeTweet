$_('grapeTweet').module('ui', function(done){
	
	var client= $('dom').select('.client.twitter');
	
	done({
		switchSheet : function(selector){
			var activeSheet= $('dom').select('.sheet.active');
			var newSheet= $('dom').select(selector);
    
    		if(activeSheet && activeSheet != newSheet){
				client.transition('change').then(function(){
					newSheet.classList.add('active');
					activeSheet.classList.remove('active');
					$$.setTimeout(function(){
						client.classList.remove('change');
					}, 30);
				});
			}else{
				newSheet.classList.add('active');
    		}
		},
		
		pagesToLeft : function(sheet, from, to){
			$('dom').select('.sheet.'+ sheet +' .page.'+ from).classList.add('left');
			$('dom').select('.sheet.' + sheet +' .page.'+ to).classList.remove('right');
		},
		
		pagesFromLeft : function(sheet, from, to){
			$('dom').select('.sheet.' + sheet +' .page.'+ from).classList.add('right');
			$('dom').select('.sheet.'+ sheet +' .page.'+ to).classList.remove('left');
		},
		
		renderContacts : function(app){
			return new $$.Promise(function(done){
				var template= $('dom').select('#contact-layout').content;
				var list= $('dom').select('.contact-list');
				
				list.innerHTML= '';
			
				app.storage.getContacts().then(function(contacts){
					$$.Object.keys(contacts).forEach(function(item){
						item= contacts[item];
						var element= template.cloneNode(true);
					
						element.querySelector('.contact').dataset.userId= item.id;
						element.querySelector('.user-image').style.setProperty('background-image', 'url("'+ item.profile_image_url +'")');
						element.querySelector('.displayname').textContent= item.name;
						element.querySelector('.username').textContent= '@' + item.screen_name;
            	
						list.appendChild(element);
					});
					done();
				});
			});
		},
		
		renderConversations : function(app){
			return new Promise(function(done){
				app.storage.getConversationsList(app.account.userId).then(function(convIDs){
					var promises= [];
				
					convIDs.forEach(function(item){
						promises.push(app.storage.getConversation(item));
					});
					
					promises.push(app.storage.getContacts());
				
					$$.Promise.all(promises).then(function(values){
						var convs= {};
						var template= $('dom').select('#conv-layout').content;
						var list= $('dom').select('.conv-list');
						var contacts= values.pop();
					
						values.forEach(function(item, index){
							convs[convIDs[index]]= item;
						});
						
						list.innerHTML= '';
				
						$$.Object.keys(convs).forEach(function(userId){
							var latest= convs[userId].sort(app.misc.sortByDate).last();
							var user= contacts[userId];
				
							var element= template.cloneNode(true);
			
							element.querySelector('.conv').dataset.userId= userId;
							if(!app.dataStatus.conversationsStatus[userId]){
								app.dataStatus.conversationsStatus[userId]= '';
								app.setState({
									name : 'dataStatus',
									conversationsStatus : app.dataStatus.conversationsStatus
								});
							}
							
							if(latest.sender_id != app.account.userId && latest.id_str != app.dataStatus.conversationsStatus[latest.sender_id])
								element.querySelector('.conv').classList.add('unread');
							else if(latest.sender_id == app.account.userId)
								element.querySelector('.conv').classList.add('my');
							
							element.querySelector('.user-image').style.setProperty('background-image', 'url('+ user.profile_image_url +')');
							element.querySelector('.displayname').textContent= user.name;
				
							if( (user.name + '@' + user.screen_name).length > 23)
								element.querySelector('.username').textContent= ('@' + user.screen_name).substr(0, 23-user.name.length) + '...';
							else
								element.querySelector('.username').textContent= '@' + user.screen_name;
				
							element.querySelector('.datetime').textContent= '0h';
							element.querySelector('.conv-body .text').textContent= ((latest.text.length <= 40) ? latest.text : latest.text.substr(0, 40) + '...');
				
							list.appendChild(element);
						});
						
						done();
					});
				});
			});
		},
		
		renderChat : function(app, userId){
			var self= this;
			
			return new $$.Promise(function(done){
				$$.Promise.all([app.storage.getConversation(userId), app.storage.getContact(userId)]).then(function(values){
					var conversation= values[0].sort(app.misc.sortByDate);
					var contact= values[1];
					var userImage= $('dom').select('.page.chat .header-user-image');
					var template_default= $('dom').select('#chat-message-layout').content;
					var template_my= $('dom').select('#chat-my-message-layout').content;
					var list= $('dom').select('.message-list');
					var body= $('dom').select('.page.chat .body');
		
					$('dom').select('.page.chat .back-title').textContent= contact.name;
				
					app.setState({
						name : 'dataStatus',
						lastChat : contact.id
					});
					userImage.style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
					userImage.href= '#!/profile/'+ contact.id;
				
					if(list.dataset.userId != contact.id)
						list.innerHTML= '';
				
					conversation.forEach(function(item){
						if($('dom').select('.message[data-id="'+item.id_str+'"]') == null){
							
							if(item.sender_id == app.account.userId){
								var element= template_my.cloneNode(true);
								element.querySelector('.message').dataset.id= item.id_str;
							}else{
								if(item.id_str != app.dataStatus.conversationsStatus[userId]){
									app.setState({
										name : 'account',
										unreadMessages : app.account.unreadMessages-1
									});
									
									app.dataStatus.conversationsStatus[userId]= item.id_str;
									app.setState({
										name : 'dataStatus',
										conversationsStatus : app.dataStatus.conversationsStatus
									});
								}
								var element= template_default.cloneNode(true);
								element.querySelector('.user-image').style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
								element.querySelector('.message').dataset.id= item.id_str;
							}
							
//							format text
							self.renderEntities(item.text, item.entities, element.querySelector('.text'), app);
						
							list.appendChild(element);
						}
					});
					
					app.ui.renderFooterStatus(app.account);
					body.scrollTop= body.scrollHeight;
					list.dataset.userId= contact.id;
					done();
				});
			});
		},
										
		renderEntities : function(text, entities, target, app){
//			add medias
			if(entities.media){
				entities.media.forEach(function(item){
					if(item.type == 'photo'){
						text= text.replace(item.url, '');
						var img= $('dom').create('img');
						img.onload= function(){
							var chatBody= $('dom').select('.page.chat .body');
							chatBody.scrollTop= chatBody.scrollHeight;
						};
						target.appendChild(img);
						app.net.cacheImage(item.media_url, app).then(function(url){
							img.src= url;
						});
					}
				});
			}
		
//			set text
			target.appendChild($$.document.createTextNode(text));
		},
		
		renderFooterStatus : function(account){
			var label= $('dom').select('.footer .messages .count');
			if(account.unreadMessages > 0){
				label.textContent= account.unreadMessages;
				label.classList.remove('hidden');
			}else{
				label.classList.add('hidden');
			}
		}
	});
});