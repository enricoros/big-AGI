import * as React from 'react';
import { useMemberstack } from "@memberstack/react";

const config = { publicKey: "pk_a60a3b251b447d03d202" }
  function Index() {
    return (
      <MemberstackProvider config={config}>
          <App />
      </MemberstackProvider>
    )
  }

  function Dashboard() {
    const memberstack = useMemberstack();
    const [member, setMember] = React.useState(null);

  React.useEffect(() => {
    memberstack.getCurrentMember().then(({ data: member }) => setMember(member))
  }, []);
    
    if (!member) return null;
    return <div>Welcome, {member.auth.email}</div>;
  }