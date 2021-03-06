$_('grapeTweet').module('UI', ['Storage', 'Misc', 'Net', 'Cache'], function(App, done){

    var client= $('dom').select('.client.twitter');

    var { Storage, Misc, Net, Cache } = App.modules;

    var renderMessage= function(item, contact, insertBefore, avatarize){
        var template_default= $('dom').select('#chat-message-layout').content;
        var template_my= $('dom').select('#chat-my-message-layout').content;
        var list= $('dom').select('.message-list');
        var firstElement= $('dom').select('.page.chat .message-list li');
        var element= null;
        var out = item.sender_id == App.Account.userId;
        contact= contact || (item.sender_id != App.Account.userID ? item.sender : item.recipient);

        if(!list.querySelector('li[data-id="'+ item.id_str +'"]')){
            if(out){
                element= template_my.cloneNode(true);
                element.querySelector('.message').dataset.id= item.id_str;
            }else{
                element= template_default.cloneNode(true);
                if(avatarize)
                    element.querySelector('.user-image').style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
                element.querySelector('.message').dataset.id= item.id_str;
            }

//	 	    format text
            renderEntities(item.text, item.entities, element.querySelector('.text'));
            Storage.storeMessage(item);

//		    timestamp
            var date= new Date(item.created_at);
            element.querySelector('.date').textContent= date.toLocaleDateString() + ', ' + date.toLocaleTimeString();

            if(!insertBefore)
                list.appendChild(element);
            else
                list.insertBefore(element, firstElement);

            return out;
        }
    };

    var renderEntities= function(text, entities, target, tweet){

        var textElement= $('dom').create('div');
        textElement.innerHTML= text;
        target.appendChild(textElement);

//      add medias
        if(entities.media){
            var downloadImage= function(item){
                var img= this;
                img.src= '../img/downloading-thumb.png';
                img.dataset.status= item.status || '';
                if(img.dataset.status === ''){
                    Net.downloadImage(item.media_url).then(function(data){
                        img.src= data.url;
                        img.dataset.status= item.status= 'downloaded';

                        if(!tweet){
                            Cache.save(item.media_url, data.blob, true);
                        }else{
                            Cache.save(item.media_url, data.blob, false);
                        }
                        addImageListeners(img, img, data.blob, data.url);
                    });
                }
                img.dataset.status= 'downloading';
            };
            var addImageListeners= function(item, img, blob, url){
                if($$.MozActivity){
                    img.addEventListener('click', function(){
                        new $$.MozActivity({
                            name : 'open',
                            data : {
                                type : blob.type,
                                blob : blob
                            }
                        });
                    });
                }
                if(tweet){
                    img.addEventListener('contextmenu', function(e){
                        e.preventDefault();
                        var link= $('dom').create('a');
                        link.href= url;
                        link.download= item.media_url.substr(item.media_url.lastIndexOf('/'));
                        $$.document.body.appendChild(link);
                        link.click();
                        $$.document.body.removeChild(link);
                    });
                }
            };

            entities.media.forEach(function(item){
                if(item.type == 'photo'){
                    textElement.innerHTML= textElement.innerHTML.replace(item.url, '');
                    var img= $('dom').create('img');

                    img.style.height= target.style.minHeight= item.sizes.large.h / item.sizes.large.w * ($$.innerWidth - 34 - ($$.innerWidth / 100 * 25))+'px';
                    if(item.status == 'downloaded'){
                        Cache.recover(item.media_url).then(function(blob){
                            var url= $$.URL.createObjectURL(blob);
                            img.src= url;
                            addImageListeners(item, img, blob, url);
                        });
                    }
                    if(!tweet){
                        img.src= "../img/image-thumb.png";
                        img.addEventListener('click', downloadImage.bind(img, [item]));
                    }else{
                        downloadImage.apply(img, [item]);
                    }
                    target.appendChild(img);
                }
            });
        }

        if(entities.urls){
            entities.urls.forEach(function(item){
                textElement.innerHTML= textElement.innerHTML.replace(item.url, '<a href="'+ item.url +'" target="_blank">'+ item.display_url +'</a>');
            });
        }
    };

    var getTimeSince= function(timeSting){
        var now= new Date();
        var from= new Date(timeSting);
        var time= new Date(now - from);

        if(time.getYear() - 70 > 0)
            return (time.getYear() - 70) + 'Y';
        else if(time.getMonth() > 0)
            return time.getMonth() + 'M';
        else if(time.getDate() - 1 > 0)
            return (time.getDate() - 1) + 'd';
		else if(time.getHours() - 1 > 0)
            return (time.getHours() - 1) + 'h';
        else if(time.getMinutes() > 0)
            return time.getMinutes() + 'm';
        else if(time.getSeconds() > 0)
            return time.getSeconds() + 's';
        else
            return 'now';
	};

	var interface= {
        switchSheet : function(selector){
            var activeSheet= $('dom').select('.sheet.active');
            var newSheet= $('dom').select(selector);

            if(activeSheet && activeSheet != newSheet){
                activeSheet.querySelector('.body').style.setProperty('will-change', 'opacity');
                newSheet.querySelector('.body').style.setProperty('will-change', 'opacity');
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

        renderContacts : function(){
            var contacts= App.Contacts.record;
            var template= $('dom').select('#contact-layout').content;
            var list= $('dom').select('.contact-list');

            list.innerHTML= '';

            $$.Object.keys(contacts).forEach(function(item){
                item= contacts[item];
                var element= template.cloneNode(true);

                element.querySelector('.contact').dataset.userId= item.id;
                element.querySelector('.user-image').style.setProperty('background-image', 'url("'+ item.profile_image_url +'")');
                element.querySelector('.displayname').textContent= item.name;
                element.querySelector('.username').textContent= '@' + item.screen_name;

                list.appendChild(element);
            });
        },

        renderChats : function(chatId){
            var conversations = App.Conversations.record;
            var tempList= {};
            var contacts = App.Contacts.record;
            var template= $('dom').select('#conv-layout').content;
            var list= $('dom').select('.conv-list');

            if(!chatId){

//              sort conversations
                $$.Object.keys(conversations).map(function(id){
                    return { id:id, created_at : conversations[id].lastMessage.created_at };
                })

                .sort(Misc.sortByDate).reverse().map(function(item){
                    tempList[item.id]= conversations[item.id];
                });

                conversations= tempList;

            }else{
                conversations= {
                    chatId : conversations[chatId]
                };
            }

            $$.Object.keys(conversations).forEach(function(userId){
                var conv= conversations[userId];
                var latest= conv.lastMessage;
                var user= contacts[userId]  || (latest.sender_id_str != App.Account.userId ? latest.sender : latest.recipient);
                var old= null;
                var element= template.cloneNode(true);

                element.querySelector('.conv').dataset.userId= userId;

                if(conv.unread > 0)
                    element.querySelector('.conv').classList.add('unread');
                else if(latest.sender_id == App.Account.userId)
                    element.querySelector('.conv').classList.add('my');

                element.querySelector('.user-image').style.setProperty('background-image', 'url('+ user.profile_image_url +')');
                element.querySelector('.displayname').textContent= user.name;

                if( (user.name + '@' + user.screen_name).length > 23)
                    element.querySelector('.username').textContent= ('@' + user.screen_name).substr(0, 23-user.name.length) + '...';
                else
                    element.querySelector('.username').textContent= '@' + user.screen_name;

                element.querySelector('.datetime').textContent= getTimeSince(latest.created_at);
                element.querySelector('.conv-body .text').textContent= ((latest.text.length <= 40) ? latest.text : latest.text.substr(0, 40) + '...');

                if((old= list.querySelector('[data-user-id="'+ userId +'"]')) !== null){
                    list.replaceChild(element, old);
                }else{
                    list.appendChild(element);
                }
            });
        },

        renderChat : function(userId){
            var conversation= App.Conversations.record[userId];
            var contact= App.Contacts.record[userId] ? App.Contacts.record[userId] : (conversation.lastMessage.sender || conversation.lastMessage.recipient);
            var list= $('dom').select('.message-list');
            var differentConv= (list.dataset.userId != userId);
            var userImage= $('dom').select('.page.chat .header-user-image');
            var body= $('dom').select('.page.chat .body.c');

//			close notification for this conversation
            $$.Notification.get().then(function(list){
                list.forEach(function(item){
                    if(item.tag == userId)
                        item.close();
                });
            });

//			setup page
            if(differentConv){
                list.innerHTML= '';
                $('dom').select('.page.chat .back-title').textContent= contact.name;

                userImage.style.setProperty('background-image', 'url('+ contact.profile_image_url +')');
                userImage.href= '#!/people/profile/'+ contact.id;
                list.dataset.userId= contact.id;
            }

            if(conversation){
                var handle= function(messages){
                    var avatarize = (list.childNodes.length > 0) ? list.lastElementChild.classList.contains('me') : true;

                    if(messages.length > 0){
                        messages.sort(Misc.sortByDate);
                        messages.forEach(function(item){
                            avatarize = renderMessage(item, contact, false, avatarize);
                        });

                        App.Account.unreadMessages-= conversation.unread;
                        conversation.lastReadMessage= messages.last().id_str;
                        conversation.unread= 0;
                        App.Conversations.save();

                        interface.renderFooterStatus(App.Account);
                    }
                };

                if(differentConv){
                    Storage.getMessagesChunkBefore(conversation.lastMessage.id_str, true).then(handle).then(function(){
                        body.scrollTop= body.scrollHeight;
                    });
                }else{
                    var scroll= (body.scrollTop == (body.scrollHeight - body.offsetHeight));
                    Storage.getNewMessagesSince(conversation.lastReadMessage).then(handle).then(function(){
                        if(scroll) body.scrollTop= body.scrollHeight;
                    });
                }
            }
        },

        renderAdditionalChunk : function(){
            return new $$.Promise(function(done){
                var lastElement= $('dom').select('.page.chat .message-list li');
                var body= $('dom').select('.page.chat .body');
                var scrollHeight= body.scrollHeight;

                if(lastElement){
                    $$.Promise.all([Storage.getMessagesChunkBefore(lastElement.dataset.id, false), Storage.getContact(App.DataStatus.DMs.lastChat)]).then(function(values){
                        var messages= values[0].sort(Misc.sortByDate);
                        var contact= values[1];
                        var avatarize = $('dom').select('.page.chat .message-list').lastElementChild.classList.contains('me');

                        messages.reverse().forEach(function(item){
                            avatarize = renderMessage(item, contact, true, avatarize);
                        });

                        body.scrollTop= body.scrollHeight - scrollHeight - 20;
                        done();
                    });
                }else{
                    done();
                }
            });
        },

        renderFooterStatus : function(account){
            var label= $('dom').select('.footer .messages .count');
            if(account.unreadMessages > 0){
                label.textContent= account.unreadMessages;
                label.classList.remove('hidden');
            }else{
                label.classList.add('hidden');
            }
        },

        renderTweets : function(timeline){
            return Storage.getTweetsChunkBefore(timeline.last, timeline, true).then(function(tweets){
                var template= $('dom').select('#tweet-layout').content;
                var list= $('dom').select('.streams .page[data-id="'+ timeline.id +'"] .tweet-list');

                list.innerHTML= '';
                tweets.forEach(function(tweet){
                    var element= template.cloneNode(true);

                    element.querySelector('.tweet').dataset.id= tweet.id_str;
                    element.querySelector('.displayname').textContent= tweet.user.name;
                    element.querySelector('.username').textContent= '@' + tweet.user.screen_name;
                    element.querySelector('.user-image').style.setProperty('background-image', 'url('+ tweet.user.profile_image_url +')');
                    element.querySelector('.datetime').textContent= getTimeSince(tweet.created_at);
                    renderEntities(tweet.text, tweet.entities, element.querySelector('.text'), true);
                    Storage.storeTweet(tweet, timeline);

                    list.appendChild(element);
                });
            });
        },

        renderTimeline : function(timeline){
            var template= $('dom').select('#timeline-layout').content;
            var element= template.cloneNode(true);

            element.querySelector('.title').textContent= timeline.name;
            element.querySelector('.page').dataset.id= timeline.id;
            element.querySelector('.body').addEventListener('scroll', function(e){
                e.preventDefault();
            });
            element.querySelector('.body').addEventListener('touchmove', function(e){
                if((this.enabled || this.target.scrollTop === 0) && !this.open){
                    if(!this.enabled){
                        this.touch= e.touches.indexOf(e.changedTouches[0]);
                        this.start= e.touches[this.touch].screenY;
                        this.enabled= true;
                        this.target.addEventListener('touchend', this.release.bind(this));
                        this.element.classList.remove('closed');
                    }else{
                        e.preventDefault();
                        var force= e.touches[this.touch].screenY - this.start;
                        var y= (force / 5);
                        if(y < 76){
                            this.element.style.setProperty('transform', 'translateY(' + y + 'px)');
                        }else{
                            this.release.apply(this);
                        }
                    }
                }
            }.bind({
                target : element.querySelector('.body'),
                element : element.querySelector('.check-new'),
                timeline : timeline.id,
                enabled: false,
                start : 0,
                touch : null,
                open : false,
                release : function(e){
                    if(this.enabled && (!e || e.touches.indexOf(this.touch) < 0)){
                        var state= parseInt(this.element.style.getPropertyValue('transform').replace(/translateY\(/, '').replace(/px\)/, ''));
                        if(state > 37){
                            this.element.classList.add('open');
                            this.element.textContent= 'checking for new Tweets...';
                            this.open= true;
                            var data= this;
                            Storage.getTimeline(this.timeline).then(function(timeline){
                                Net.fetchNewHomeTweets(timeline).then(function(){
                                    interface.renderTweets(timeline).then(function(){
                                        data.element.classList.add('closed');
                                        data.element.classList.remove('open');
                                        data.element.textContent= "release to check for new Tweets";
                                        data.open= false;
                                    });
                                }, function(){
                                    data.element.textContent= 'ratelimit exceed, try again later.';
                                    $$.setTimeout(function(){
                                        data.element.classList.add('closed');
                                        data.element.classList.remove('open');
                                        data.element.textContent= "release to check for new Tweets";
                                        data.open= false;
                                    }, 10000);
                                });
                            });
                        }else{
                            this.element.classList.add('closed');
                        }
                        this.start= 0;
                        this.enabled= false;
                        this.element.style.setProperty('transform', '');
                    }
                }
            }));

            element.querySelector('.header').addEventListener('click', function(){
                if(!this.active){
                    this.active= true;
                    var int= $$.setInterval(function(){
                        if(this.element.scrollTop > 0){
                            this.element.scrollTop-= 40;
                        }else{
                            $$.clearInterval(int);
                            this.active= false;
                        }
                    }.bind(this), 0);
                }
            }.bind({
                element : element.querySelector('.body'),
                active : false
            }));

            interface.bindHeader(element.querySelector('header'));

            $('dom').select('.streams').appendChild(element);
        },

        bindHeader : function(header){
            header.addEventListener('touchstart', function(e){
                var data= {
                    touch : e.targetTouches[0].identifier,
                    last : e.targetTouches[0].screenY,
                    distance : 0,
                    target : $('dom').select('.client')
                };

                var tracker= function(e){
                    var distanceMax= $('dom').select('.search').offsetHeight;
                    var touch= e.touches.find(function(item){ return (item.identifier == this.touch); }, this);
					this.distance+= touch.screenY - this.last;
                    this.last= touch.screenY;

                    if(this.distance > 0){
                        this.target.style.setProperty('transform', 'translateY(' + (this.distance < distanceMax ? this.distance : distanceMax) + 'px)');
                    }
                }.bind(data);

                var release= function(e){
                    var touch= e.touches.find(function(item){ return (item.identifier == this.touch); }, this);

                    if(!touch){
                        var distanceMax= $('dom').select('.search').offsetHeight;

                        $$.removeEventListener('touchmove', tracker);
                        $$.removeEventListener('touchend', release);
                        if(this.distance > (distanceMax / 2)){
                            this.target.classList.add('searchOpen');
                        }

                        this.target.classList.remove('fixed');
                        this.target.style.removeProperty('transform');
                    }
                }.bind(data);

                data.target.classList.add('fixed');
                if(data.target.classList.contains('searchOpen')){
                    data.distance= $('dom').select('.search').offsetHeight;
                    data.target.style.setProperty('transform', 'translateY(' + data.distance + 'px)');
                    data.target.classList.remove('searchOpen');
                }
                $$.addEventListener('touchmove', tracker);
                $$.addEventListener('touchend', release);
            });
        },

        findElement : function(element, selector){
            var target= null;
            while(!target){
                target= element.querySelector(selector);
                element= element.parentNode;
                if(!element) break;
            }
            return target;
        }
    };

    done(interface);
});
