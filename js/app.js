$_('grapeTweet').main(function(){
  
 	var app= this;
	var OAuthClient= $('connections').classes.OAuthClient;
	
	var defaultSize= {
		height : $$.innerHeight,
		width : $$.innerWidth
	};
  
  	this.twitterSocket= new OAuthClient('twitter', 'https://api.twitter.com', 'gC7HaQ7T4u8HYGgRIhiLz0xGs', 'vNOVVig70BQl0pXjzpaU7Mf88Jd6O2gzTQ6FavnGUTalGtnMM1', { mozSystem : true });
	
	$$.app= this;
  
  	this.account= {
		userId : null,
		contacts : {},
		conversations : {}
	};
	
	this.dataStatus= {
		lastDM_in : '',
		lastDM_out : '',
		lastTweet : ''
	};
	
	this.cache= {
		images : {
			
		}
	};
	
	this.loadTimeline= function(){
    	this.twitterSocket.request('/statuses/home_timeline.json', { count : 50, include_entities : 'true'});
  	};
  
	this.ready= function(){
		$$.Promise.all([this.net.syncContacts(app), this.net.downloadDirectMessages(app)]).then(function(){
			
			app.ui.renderContacts(app.account);
			app.ui.renderConversations(app.account);
			$('hash').restore();
			
			if($$.location.hash.indexOf('/chat/') > -1)
				app.ui.renderChat(app, app.account, '');
    
// 			everything is done we can open the UI.
			$('dom').select('.client').classList.remove('right');
			$('dom').select('.splash').transition('left').then(function(){
				$('dom').select('.splash').classList.add('hidden');
			});
		});
	};
	
//	mouse events for lists
	$('dom').select('.conv-list').addEventListener('click', function(e){
		app.ui.renderChat(app, app.account, e.target.dataset.userId);
		$$.location.hash= '#!/messages/chat';
	}, false);
	
	$('dom').select('.contact-list').addEventListener('click', function(e){
		app.ui.renderChat(app, app.account, e.target.dataset.userId);
		$$.location.hash= '#!/messages/chat';
	});
  
	$('dom').selectAll('.tweet-list .tweet').forEach(function(item){
		item.addEventListener('click', function(){
			if(this.classList.contains('collapsed'))
				this.classList.remove('collapsed');
			else
				this.classList.add('collapsed');
		}, false);	
	});
	
//	listen for keyboard
	$$.addEventListener('resize', function(){
		if($$.innerHeight < defaultSize.height && $$.innerWidth == defaultSize.width){
			$('dom').select('.client').classList.add('footer-closed');
			var chatbody= $('dom').select('.chat .body');
			chatbody.scrollTop= chatbody.scrollTopMax;
		}else
			$('dom').select('.client').classList.remove('footer-closed');
	}, false);
  
//	top level navigation 
  	$('hash').mount(['/', '/streams', '/messages', '/notifications', '/find', '/settings'], function(path){
		var sheet= path.split('/')[1];
		sheet= (sheet === '') ? 'streams' : sheet;
    
		$('dom').select('.footer .'+sheet).classList.add('active');
    	app.ui.switchSheet('.sheet.'+sheet);
  	}, function(path){
    	var sheet= path.split('/')[1];
		sheet= (sheet === '') ? 'streams' : sheet;
    
		$('dom').select('.footer .'+sheet).classList.remove('active');
	});
  
// 	messages navigation
  	$('hash').mount('/messages/contacts', function(){
		$('dom').select('.sheet.messages .contacts').classList.remove('right');
	}, function(){
		$('dom').select('.sheet.messages .contacts').classList.add('right');
  	}, true);
	
  	$('hash').mount('/messages/chat', function(){
		app.ui.pagesToLeft('messages', 'conversations', 'chat');
	}, function(){
		app.ui.pagesFromLeft('messages', 'chat', 'conversations');
  	}, true);
  
// 	settings
  	$('hash').mount('/settings/about', function(){
		app.ui.pagesToLeft('settings', 'main', 'about');
	}, function(){
		app.ui.pagesFromLeft('settings', 'about', 'main');
  	}, true);
  
// 	profile
  	$('hash').mount('/profile', function(){
    	$('dom').select('.sheet.profile').classList.remove('bottom');
  	}, function(){
		$('dom').select('.sheet.profile').classList.add('bottom');
	});
  
// 	checking the current login  
  	if(!this.twitterSocket.isLoggedIn()){
    	
		this.twitterSocket.requestToken('/oauth/request_token', 'oob').then(function(){
			$('dom').select('.splash .signIn').classList.remove('hidden');
    	});
    
    	$('dom').select('.splash .signIn').addEventListener('click', function(){
			app.twitterSocket.authenticate('/oauth/authenticate');
			var verify= $('dom').select('.splash .verify');
			var code= $('dom').select('.splash .code');
        
			$('dom').select('.splash .signIn').classList.add('hidden');
			code.classList.remove('hidden');
			verify.classList.remove('hidden');
        
			code.addEventListener('focus', function(){
				$('dom').select('.splash .logo').classList.add('hidden');
			}, false);
      		code.onblur= function(){
				$('dom').select('.splash .logo').classList.remove('hidden');
			};
        
			verify.addEventListener('click', function(){
				app.twitterSocket.verify('/oauth/access_token', code.value).then(function(userId){
					app.account.userId= userId;
					$$.localStorage.setItem('account.userid', userId);
					app.ready();
				});
			}, false);
		}, false);
    
  	}else{
		app.account.userId= $$.localStorage.getItem('account.userid');
		app.ready();
	}
  
});