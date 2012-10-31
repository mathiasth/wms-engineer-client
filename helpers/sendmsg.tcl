set url "http://127.0.0.1:8001/DispatchInterface"

set msg {
<AppointmentCreate>
  <Engineer>10002</Engineer>
  <Task>
    <Finish>2012-09-01T10:30:00</Finish>
    <Start>2012-09-01T10:00:00</Start>
    <ID>A|0003</ID>
    <Comment>Cryptonite in sink</Comment>
    <Customer>Kent, Clark</Customer>
    <Status>Dispatched</Status>
    <TaskType>Electricity</TaskType>
  </Task>
</AppointmentCreate>
}

package require http

set token [::http::geturl $url -query $msg]
set data [::http::data $token]

puts $data
