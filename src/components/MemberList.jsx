export default function MemberList({ server, users }) {
  if (!server) return null

  const members = users.filter((user) => server.memberIds?.includes(user._id))

  return (
    <aside className="member-list">
      <div className="member-list-header">
        <h3>Thành viên</h3>
        <span className="member-count">{members.length}</span>
      </div>
      <div className="member-list-scroll">
        {members.map((member) => (
          <div className="member-item" key={member._id}>
            <div className="member-avatar">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.username} />
              ) : (
                member.username.charAt(0).toUpperCase()
              )}
            </div>
            <span className="member-name">{member.username}</span>
            <span className={`member-role member-role--${member.role}`}>{member.role}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
