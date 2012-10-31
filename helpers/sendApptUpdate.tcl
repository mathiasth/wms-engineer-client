set url "http://127.0.0.1:8001/DispatchInterface"

set msg {
<AppointmentUpdate>
  <Engineer>10002</Engineer>
  <Task>
    <Finish>2012-09-01T15:05:00</Finish>
    <Start>2012-09-01T14:50:00</Start>
    <ID>A|00002</ID>
    <Comment>Cryptonite in sink</Comment>
    <Customer>Kent, Clark</Customer>
    <Status>Dispatched</Status>
    <TaskType>Electricity</TaskType>
  </Task>
</AppointmentUpdate>
}

package require http

set token [::http::geturl $url -query $msg]
set data [::http::data $token]

puts $data