set url "http://127.0.0.1:8001/DispatchInterface"

set msg {
<AppointmentCreate Destination="OfficeMiddleTier" CreatedBy="CLICKONE\w6user"><Engineers><Engineer><ID>10013</ID></Engineer></Engineers><Task><CallID>HE09</CallID><Comment></Comment><Customer>Tobi Zaxx 2</Customer><Duration>4500</Duration><Number>1</Number><Status><Name>Dispatched</Name></Status><TaskType><Name>Electricity</Name></TaskType></Task><Assignment><Finish>2011-01-03 10:25:00</Finish><Start>2011-01-03 09:10:00</Start></Assignment></AppointmentCreate>
}

package require http

set token [::http::geturl $url -query $msg]
set data [::http::data $token]

puts $data
