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
		
		renderContacts : function(account){
			var template= $('dom').select('#contact-layout').content;
			var list= $('dom').select('.contact-list');
			$$.Object.keys(account.contacts).forEach(function(item){
				var element= template.cloneNode(true);
				item= account.contacts[item];
        		    
				element.querySelector('.contact').dataset.userId= item.id;
				element.querySelector('.user-image').style.setProperty('background-image', 'url("'+ item.profile_image_url +'")');
				element.querySelector('.displayname').textContent= item.name;
				element.querySelector('.username').textContent= '@' + item.screen_name;
            
				list.appendChild(element);
			});
		},
		
		renderConversations : function(account){
			var convs= account.conversations;
			var template= $('dom').select('#conv-layout').content;
			var list= $('dom').select('.conv-list');
			
			$$.Object.keys(convs).forEach(function(userId){
				var latest= account.conversations[userId].last();
				var user= account.contacts[userId];
				
				var element= template.cloneNode(true);
			
				element.querySelector('.conv').dataset.userId= userId;
				if(latest.sender_id == account.userId) element.querySelector('.conv').classList.add('read');
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
		},
		
		renderChat : function(app, account, userId){
			var self= this;
			var conversation= account.conversations[userId];
			var contact= account.contacts[userId];
			var userImage= $('dom').select('.page.chat .header-user-image');
			var template_default= $('dom').select('#chat-message-layout').content;
			var template_my= $('dom').select('#chat-my-message-layout').content;
			var list= $('dom').select('.message-list');
			var body= $('dom').select('.page.chat .body');
		
			$('dom').select('.page.chat .back-title').textContent= contact.name;
			
			if(list.dataset.userId != contact.id){
				list.dataset.userId= contact.id;
				userImage.style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
				userImage.href= '#!/profile/'+ contact.id;
			
				list.innerHTML= '';
			
				if(conversation){
					conversation.forEach(function(item){
						if(item.sender_id == account.userId){
							var element= template_my.cloneNode(true);
						}else{
							var element= template_default.cloneNode(true);
							element.querySelector('.user-image').style.setProperty('background-image', 'url('+ account.contacts[userId].profile_image_url +')');
						}
					
//						format text
						self.renderEntities(item.text, item.entities, element.querySelector('.text'), app);
						
						list.appendChild(element);
					});
				}
			
				body.scrollTop= body.scrollTopMax;
			}
		},
		
		renderEntities : function(text, entities, target, app){
//			add medias
			if(entities.media){
				entities.media.forEach(function(item){
					if(item.type == 'photo'){
						text= text.replace(item.url, '');
						var img= $('dom').create('img');
						target.appendChild(img);
						app.net.cacheImage(item.media_url, app).then(function(url){
							img.src= url;
						});
					}
				});
			}
		
//			set text
			target.appendChild($$.document.createTextNode(text));
		}
	});
});