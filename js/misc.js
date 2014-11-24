$_('grapeTweet').module('Misc', [], function(app, done){
	
	done({
		
		sortByDate : function(a, b){
			return (( (new $$.Date(a.created_at)).getTime() > (new $$.Date(b.created_at)).getTime() ) ? 1 : -1);
		},
		
		cutdown : function(string, length){
			if(string.length > length){
				var new_string= [];
				string= string.split(' ');
				if(string.length == 1){
					return string[0].substr(0, length) + '...';
				}else{
					string.forEach(function(item){
						if( (new_string.join(' ')+' '+item).length <= length )
							new_string.push(item);
					});
					return new_string.join(' ')+'...';
				}
			}else{
				return string;
			}
		},
		
		split : function(string, partLength){
			var parts= [];
			var currentPart= [];
			if(string.length > partLength){
				string= string.split(' ');	
			}
			
			while(string.length > 0){
				if((currentPart.join(' ')+ ' ' +string[0]).length <= partLength)
					currentPart.push(string.shift());
				else{
					parts.push(currentPart.join(' '));
					currentPart= [];
					
					if(string[0].length > partLength){
						parts.push(string[0].substr(0, partLength));
						string[0]= string[0].substr(partLength);
					}else{
						currentPart.push(string.shift());
					}
				}
			}
			parts.push(currentPart.join(' '));
			
			return parts;
		}
		
	});
	
});