import { useEffect, useMemo, useRef, useState } from 'react';
import { optionsListFromMembers, extractMemberIdsFromPreset } from '../../utils/sharedCartCustomizationUtils';

export default function useAssignees({
  isOpen,
  isEditing,
  preset,
  item,
  members,
  verifiedIdentity,
  quantity,
  EXTRA_SENTINEL,
}) {
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [prefillAssigneeOnOpen, setPrefillAssigneeOnOpen] = useState(true);
  const asgHydratedRef = useRef(false);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    asgHydratedRef.current = false;
    setAssigneeIds([]);
    setPrefillAssigneeOnOpen(!isEditing);
  }, [isOpen, isEditing, item?.cartRowId]);

  // Cap by quantity
  useEffect(() => {
    setAssigneeIds((prev) => prev.slice(0, quantity));
  }, [quantity]);

  // Resolve current member (id/email/name)
  const currentMemberId = useMemo(() => {
    if (!members?.length || !verifiedIdentity) return null;

    if (verifiedIdentity.memberId) {
      const hit = members.find((m) => m.id === verifiedIdentity.memberId);
      if (hit) return hit.id;
    }
    const email = String(verifiedIdentity.email || '').trim().toLowerCase();
    if (email) {
      const byEmail = members.find((m) => String(m.email || '').trim().toLowerCase() === email);
      if (byEmail) return byEmail.id;
    }
    const full = String(verifiedIdentity.fullName || '').trim().toLowerCase();
    if (full) {
      const byName = members.find((m) => String(m.full_name || '').trim().toLowerCase() === full);
      if (byName) return byName.id;
    }
    return null;
  }, [members, verifiedIdentity]);

  // Autopopulate when creating (not editing)
  useEffect(() => {
    if (!isOpen) return;
    if (isEditing) return;
    if (preset) return;
    if (item?.cartRowId) return;
    if (!members?.length) return;
    if (!currentMemberId) return;
    if (!prefillAssigneeOnOpen) return;
    if (assigneeIds.length) return;

    setAssigneeIds([currentMemberId].slice(0, quantity));
    setPrefillAssigneeOnOpen(false);
  }, [
    isOpen,
    isEditing,
    preset,
    item?.cartRowId,
    members,
    currentMemberId,
    assigneeIds.length,
    quantity,
    prefillAssigneeOnOpen,
  ]);

  // Hydrate from preset/item after members load (once per open)
  useEffect(() => {
    if (!isOpen) return;
    if (asgHydratedRef.current) return;
    if (!members?.length) return;

    const src = preset || item;
    if (!src) return;

    let ids = [];
    if (Array.isArray(src.assignedTo) && src.assignedTo.length) {
      ids = extractMemberIdsFromPreset(src.assignedTo, members, EXTRA_SENTINEL);
    }
    if (!ids.length && src.selectedOptions?.__assignment__) {
      const asg = src.selectedOptions.__assignment__;
      ids = [
        ...(Array.isArray(asg.member_ids) ? asg.member_ids : []),
        ...Array.from({ length: Number(asg.extra_count || 0) }, () => EXTRA_SENTINEL),
      ];
    }

    if (ids.length) {
      setAssigneeIds(ids.slice(0, Math.max(1, src.quantity || 1)));
      asgHydratedRef.current = true;
      setPrefillAssigneeOnOpen(false);
    }
  }, [isOpen, members, preset, item, quantity, EXTRA_SENTINEL]);

  const optionsList = useMemo(
    () => optionsListFromMembers(members, EXTRA_SENTINEL),
    [members, EXTRA_SENTINEL]
  );

  return { assigneeIds, setAssigneeIds, optionsList };
}
