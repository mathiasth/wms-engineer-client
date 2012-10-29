set url "http://192.168.0.1:8080/SO/IntegrationServices/sxpint.aspx"

set msg {
<SXPEngineerGetSchedule Revision="7.5.0">
  <Engineer>10007</Engineer>
  <TimeInterval>
    <Start>2011-01-03 00:00:00</Start>
    <Finish>2011-01-03 23:59:00</Finish>
  </TimeInterval>
  <WithNA>true</WithNA>
  <TaskRequestedProperties>
    <Item>CallID</Item>
    <Item>Number</Item>
  </TaskRequestedProperties>
  <AssignmentRequestedProperties>
    <Item>Start</Item>
    <Item>Finish</Item>
  </AssignmentRequestedProperties>
</SXPEngineerGetSchedule>
}

package require http

set token [::http::geturl $url -query $msg]
set data [::http::data $token]

puts $data
