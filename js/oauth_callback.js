this.$$= this;
var data= $$.location.search.substr(1).split('&');
data[0]= data[0].split('=');
data[1]= data[1].split('=');
$$.opener.onOAuthCallback(data);
$$.close();