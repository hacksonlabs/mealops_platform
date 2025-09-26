import React from "react";
import ReactDOM from "react-dom";
import Icon from "../../AppIcon";
import Button from "../custom/Button";

const medalEmojis = ["🥇", "🥈", "🥉"];

export function computeMemberProgress({ roster = [], items = [], ownerMemberId = null }) {
  const memberMap = new Map();
  roster.forEach((member) => {
    const displayName = member.fullName || member.email || "Team member";
    memberMap.set(member.id, {
      id: member.id,
      displayName,
      displayNameLower: displayName.toLowerCase(),
    });
  });

  let extrasCount = 0;
  let unassignedCount = 0;
  const orderMap = new Map();
  const assignmentMembersSet = new Set();

  const ensureMemberEntry = (memberId, fallbackName = "Team member") => {
    if (!memberId) return;
    if (memberMap.has(memberId)) return;
    const displayName = fallbackName || "Team member";
    memberMap.set(memberId, {
      id: memberId,
      displayName,
      displayNameLower: displayName.toLowerCase(),
    });
  };

  const assignOrderForMember = (memberId, itemIndex, fallbackName) => {
    if (!memberId) return;
    ensureMemberEntry(memberId, fallbackName);
    if (orderMap.has(memberId)) return;
    orderMap.set(memberId, { order: orderMap.size, itemIndex });
  };

  items.forEach((item, itemIndex) => {
    const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
    const memberIds = Array.isArray(item.assignmentMemberIds) ? item.assignmentMemberIds : [];
    const assignedNames = Array.isArray(item.assignedTo) ? item.assignedTo : [];

    memberIds.forEach((memberId, idx) => {
      const name = assignedNames[idx]?.name || "Team member";
      assignOrderForMember(memberId, itemIndex, name);
      if (memberId) assignmentMembersSet.add(memberId);
    });

    const extraUnits = Math.max(0, Number.isFinite(Number(item.assignmentExtras)) ? Number(item.assignmentExtras) : 0);
    extrasCount += extraUnits;

    const claimedByMembers = memberIds.filter(Boolean).length;
    const unassignedForItem = Math.max(0, quantity - claimedByMembers - extraUnits);
    unassignedCount += unassignedForItem;
  });

  const ownerAddedMembers = new Set();
  if (ownerMemberId) {
    items.forEach((item) => {
      if (item.addedByMemberId !== ownerMemberId) return;
      const memberIds = Array.isArray(item.assignmentMemberIds) ? item.assignmentMemberIds : [];
      memberIds.filter(Boolean).forEach((memberId) => ownerAddedMembers.add(memberId));
    });
  }

  const assistCounts = new Map();
  items.forEach((item) => {
    const addedBy = item.addedByMemberId;
    if (!addedBy) return;
    const recipients = new Set(
      Array.isArray(item.assignmentMemberIds) ? item.assignmentMemberIds.filter(Boolean) : []
    );
    recipients.forEach((memberId) => {
      if (memberId === addedBy) return;
      assistCounts.set(addedBy, (assistCounts.get(addedBy) || 0) + 1);
    });
  });

  const medalAssignments = {};
  Array.from(orderMap.entries())
    .filter(([memberId]) => memberId && memberId !== ownerMemberId && !ownerAddedMembers.has(memberId))
    .sort((a, b) => a[1].order - b[1].order)
    .slice(0, medalEmojis.length)
    .forEach(([memberId], index) => {
      medalAssignments[memberId] = medalEmojis[index];
    });

  const decoratedMembers = Array.from(memberMap.values()).map((member) => {
    const orderInfo = orderMap.get(member.id);
    const assistCount = assistCounts.get(member.id) || 0;
    const isOwner = ownerMemberId && member.id === ownerMemberId;
    return {
      ...member,
      hasOrdered: orderInfo != null,
      orderIndex: orderInfo?.order ?? null,
      medal: isOwner ? null : medalAssignments[member.id] || null,
      assistCount,
      isOwner: Boolean(isOwner),
    };
  });

  const orderedMembers = decoratedMembers
    .filter((member) => member.hasOrdered)
    .sort((a, b) => {
      if (a.orderIndex == null && b.orderIndex == null) return a.displayName.localeCompare(b.displayName);
      if (a.orderIndex == null) return 1;
      if (b.orderIndex == null) return -1;
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.displayName.localeCompare(b.displayName);
    });

  const waitingMembers = decoratedMembers
    .filter((member) => !member.hasOrdered)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const assignmentMembers = Array.from(assignmentMembersSet).filter(
    (memberId) => memberId && memberId !== ownerMemberId
  );
  const hasRecipients = assignmentMembers.length > 0;

  return {
    orderedMembers,
    waitingMembers,
    extrasCount,
    unassignedCount,
    hasRecipients,
    assignmentMembers,
  };
}

function CartMemberProgressModal({
  open,
  onClose,
  orderedMembers = [],
  waitingMembers = [],
  loading = false,
  error = "",
  extrasCount = 0,
  unassignedCount = 0,
  hasRecipients = false,
  assignmentMembers = [],
}) {
  if (!open) return null;

  const totalMembers = orderedMembers.length + waitingMembers.length;

  const renderMemberLine = (member, { showAccents } = { showAccents: true }) => (
    <p className="truncate text-sm font-medium text-foreground">
      {showAccents && !member.isOwner && member.medal && <span className="mr-1">{member.medal}</span>}
      {member.displayName}
      {showAccents && !member.isOwner && member.assistCount > 0 && (
        <span className="ml-1 text-[11px] text-primary/80">{"🚀".repeat(member.assistCount)}</span>
      )}
    </p>
  );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[1300] bg-black/50 p-4 md:p-6" onClick={onClose}>
      <div
        className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-athletic-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Order progress"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="Users" size={18} />
            <span>Cart members</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {loading && <div className="text-sm text-muted-foreground">Loading member status…</div>}
          {!loading && error && <div className="text-sm text-destructive">{error}</div>}

          {!loading && !error && (
            <>
              {hasRecipients ? (
                <>
                  <div className="mb-5 grid gap-3 text-[12px] font-medium text-muted-foreground sm:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-center">
                      <span className="block text-base font-semibold text-foreground">{totalMembers}</span>
                      Total members
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-600/10 px-3 py-2 text-center text-emerald-700">
                      <span className="block text-base font-semibold text-emerald-700">{orderedMembers.length}</span>
                      Ordered
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-500/10 px-3 py-2 text-center text-amber-700">
                      <span className="block text-base font-semibold text-amber-700">{waitingMembers.length}</span>
                      Waiting
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
                      <header className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                        <span>Ordered</span>
                        <span>{orderedMembers.length}</span>
                      </header>
                      {orderedMembers.length ? (
                        <ul className="space-y-2">
                          {orderedMembers.map((member) => (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                            >
                              <div className="min-w-0">{renderMemberLine(member, { showAccents: hasRecipients })}</div>
                              <Icon name="CheckCircle2" size={16} className="text-emerald-600" aria-hidden="true" />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                          No orders yet.
                        </div>
                      )}
                    </section>

                    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
                      <header className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                        <span>Waiting</span>
                        <span>{waitingMembers.length}</span>
                      </header>
                      {waitingMembers.length ? (
                        <ul className="space-y-2">
                          {waitingMembers.map((member) => (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2"
                            >
                              <div className="min-w-0">{renderMemberLine(member, { showAccents: hasRecipients })}</div>
                              <Icon name="Clock" size={16} className="text-amber-600" aria-hidden="true" />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                          Everyone is in!
                        </div>
                      )}
                    </section>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5 flex items-center gap-3 text-[12px] font-medium text-muted-foreground">
                    <div className="rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-center">
                      <span className="block text-base font-semibold text-foreground">{orderedMembers.length}</span>
                      Members Ordered
                    </div>
                  </div>

                  <section className="rounded-xl border border-border/70 bg-card/60 p-4">
                    <header className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                      <span>Ordered</span>
                      <span>{orderedMembers.length}</span>
                    </header>
                    {orderedMembers.length ? (
                      <ul className="space-y-2">
                        {orderedMembers.map((member) => (
                          <li
                            key={member.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                          >
                            <div className="min-w-0">{renderMemberLine(member, { showAccents: false })}</div>
                            <Icon name="CheckCircle2" size={16} className="text-emerald-600" aria-hidden="true" />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                        No assigned orders yet.
                      </div>
                    )}
                  </section>
                </>
              )}

              {(extrasCount > 0 || unassignedCount > 0) && (
                <div className="mt-5 space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  {extrasCount > 0 && (
                    <div>
                      <span className="font-semibold text-foreground">{extrasCount}</span>{" "}
                      Extra{extrasCount === 1 ? "" : "s"}
                    </div>
                  )}
                  {unassignedCount > 0 && (
                    <div>
                      <span className="font-semibold text-foreground">{unassignedCount}</span>{" "}
                      unassigned waiting to be claimed
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CartMemberProgressModal;
