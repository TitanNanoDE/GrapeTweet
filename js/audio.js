$_('grapeTweet').module('Audio', [], function(App, done){
    
    var sounds= {
        recieved : new $$.Audio('/sounds/recived.mp3'),
        sent : new $$.Audio('/sounds/sent.mp3')
    };
    
    done({
        play : function(sound){
            sounds[sound].play();
        } 
    });
});
