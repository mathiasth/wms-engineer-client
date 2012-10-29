set url "http://192.168.0.1:8080/SO/IntegrationServices/sxpint.aspx"

set msg1 {
<SXPTaskOperations><Task><CallID>LI11</CallID><Number>1</Number><Status>Scheduled</Status></Task></SXPTaskOperations>
}

set msg2 {
<SXPTaskOperations><Task><CallID>LI11</CallID><Number>1</Number><Status>Dispatched</Status></Task></SXPTaskOperations>
}


package require http
package require base64

set token [::http::geturl $url -query $msg1 -headers [list Authorization "Basic [::base64::encode httpuser:8765.de]"]]
set data [::http::data $token]
puts "first message: $data"
set token [::http::geturl $url -query $msg2 -headers [list Authorization "Basic [::base64::encode httpuser:8765.de]"]]
set data [::http::data $token]
puts "second message: $data"
