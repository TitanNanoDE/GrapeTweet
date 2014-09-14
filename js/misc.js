$_('grapeTweet').module('misc', function(done){
	
	done({
		
		sortByDate : function(a, b){
			return (( (new $$.Date(a.created_at)).getTime() > (new $$.Date(b.created_at)).getTime() ) ? 1 : -1);
		}
		
	});
	
});