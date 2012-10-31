set url "http://127.0.0.1:8001/DispatchInterface"

set msg {
<AppointmentDelete>
  <Engineer>10002</Engineer>
  <Task>
    <ID>A|0003</ID>
  </Task>
</AppointmentDelete>
}

package require http

set token [::http::geturl $url -query $msg]
set data [::http::data $token]

puts $data
