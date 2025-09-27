import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import Icon from "../../../components/AppIcon";
import Button from "../../../components/ui/custom/Button";
import Select from "../../../components/ui/custom/Select";
import cartDbService from "../../../services/cartDBService";
import { useAuth } from "../../../contexts";
import useTeamGroups from "../../../hooks/useTeamGroups";
import useMembers from "../../../hooks/cart/useMembers";
import { toTitleCase } from "../../../utils/stringUtils";

const orderRoles = ["Coach", "Assistant", "Manager", "Captain"];

export default function ShareCartModal({
  isOpen,
  onClose,
  cartId: inboundCartId,
  restaurant,
  providerType,
  fulfillment,
  onCreated,
  cartTitle,
  mealType,
}) {
  const { activeTeam } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [cartId, setCartId] = useState(inboundCartId || null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [membersErr, setMembersErr] = useState("");
  const [membersSuccess, setMembersSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectionMode, setSelectionMode] = useState("groups");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [manualMemberIds, setManualMemberIds] = useState([]);
  const [excludedMemberIds, setExcludedMemberIds] = useState([]);
  const [initialMembersLoaded, setInitialMembersLoaded] = useState(false);
  const lastSavedTitle = useRef("");

  const { groups, loading: groupsLoading } = useTeamGroups({
    teamId: activeTeam?.id,
    enabled: isOpen,
  });
  const { members, membersLoading } = useMembers({ teamId: activeTeam?.id, isOpen });

  const memberMap = useMemo(() => {
    const map = new Map();
    (members || []).forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const groupMap = useMemo(() => {
    const map = new Map();
    (groups || []).forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  // keep local cartId in sync with prop
  useEffect(() => setCartId(inboundCartId || null), [inboundCartId]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectionMode("groups");
    setMembersErr("");
    setMembersSuccess(false);
    setInitialMembersLoaded(false);
    const seeded = (cartTitle || "Team Cart").trim();
    setTitle(seeded);
    lastSavedTitle.current = seeded;
    setErr("");
    setSelectedGroupIds([]);
    setManualMemberIds([]);
    setExcludedMemberIds([]);
  }, [isOpen, cartTitle, inboundCartId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = useMemo(() => {
    if (!cartId) return "";
    return `${origin}/shared-cart/${encodeURIComponent(cartId)}?openCart=1`;
  }, [origin, cartId]);

  const handleCreateIfNeeded = useCallback(async () => {
    if (cartId) return cartId;
    if (!activeTeam?.id || !restaurant?.id) throw new Error("Missing team or restaurant.");

    const safeTitle = (title?.trim() || restaurant?.name || "Team Cart");
    const newId = await cartDbService.ensureCartForRestaurant(activeTeam.id, restaurant.id, {
      title: safeTitle,
      providerType: providerType ?? null,
      providerRestaurantId: restaurant?.provider_restaurant_ids?.[providerType] || null,
      fulfillment: fulfillment || {},
      mealType,
    });

    setCartId(newId);
    onCreated?.(newId);
    lastSavedTitle.current = safeTitle;
    return newId;
  }, [cartId, activeTeam?.id, restaurant, title, providerType, fulfillment, mealType, onCreated]);

  const hydrateCartMembers = useCallback(async (id) => {
    if (!id || !isOpen) return;
    try {
      const filterKnownMembers = (list = []) => {
        const unique = Array.from(new Set(list.filter(Boolean)));
        if (!memberMap?.size) return unique;
        return unique.filter((memberId) => memberMap.has(memberId));
      };

      let ids = await cartDbService.getCartMembers(id);
      ids = filterKnownMembers(ids || []);

      if (!ids.length) {
        const snapshot = await cartDbService.getCartSnapshot(id);
        const assignmentIds = snapshot?.assignmentMemberIdsSnapshot || [];
        ids = filterKnownMembers(assignmentIds);
      }

      setManualMemberIds(ids);
      setSelectedGroupIds([]);
      setExcludedMemberIds([]);
      setInitialMembersLoaded(true);
    } catch (e) {
      setMembersErr(e?.message || "Failed to load members.");
      setInitialMembersLoaded(true);
    }
  }, [isOpen, memberMap]);

  useEffect(() => {
    if (!cartId || !isOpen || initialMembersLoaded) return;
    if (!inboundCartId) {
      setInitialMembersLoaded(true);
      return;
    }
    const hasLocalSelection = selectedGroupIds.length || manualMemberIds.length || excludedMemberIds.length;
    if (hasLocalSelection) {
      setInitialMembersLoaded(true);
      return;
    }
    hydrateCartMembers(cartId);
  }, [
    cartId,
    isOpen,
    initialMembersLoaded,
    hydrateCartMembers,
    inboundCartId,
    selectedGroupIds.length,
    manualMemberIds.length,
    excludedMemberIds.length,
  ]);

  const excludedSet = useMemo(() => new Set(excludedMemberIds), [excludedMemberIds]);

  const membersFromGroups = useMemo(() => {
    const set = new Set();
    selectedGroupIds.forEach((gid) => {
      const group = groupMap.get(gid);
      if (!group) return;
      (group.memberIds || []).forEach((mid) => {
        if (!excludedSet.has(mid)) set.add(mid);
      });
    });
    return Array.from(set);
  }, [selectedGroupIds, groupMap, excludedSet]);

  const finalMemberIds = useMemo(() => {
    const set = new Set(membersFromGroups);
    (manualMemberIds || []).forEach((id) => set.add(id));
    return Array.from(set);
  }, [membersFromGroups, manualMemberIds]);

  const memberOptions = useMemo(() => {
    const roleLabel = (role) => {
      const cleaned = String(role || "").trim();
      return cleaned ? toTitleCase(cleaned) : "Other";
    };
    return (members || []).map((m) => {
      const label = m.full_name || m.email || "Member";
      return {
        value: m.id,
        label,
        search: `${label} ${m.email || ""} ${m.role || ""}`.trim().toLowerCase(),
        roleGroup: roleLabel(m.role),
      };
    });
  }, [members]);

  const groupOptions = useMemo(() => {
    return (groups || []).map((g) => ({
      value: g.id,
      label: `${g.name}${g.memberCount ? ` (${g.memberCount})` : ""}`,
      search: `${g.name} ${(g.memberIds || []).length}`.trim().toLowerCase(),
    }));
  }, [groups]);

  const selectedMembers = useMemo(() => {
    return finalMemberIds
      .map((id) => memberMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [finalMemberIds, memberMap]);

  const handleGroupsChange = useCallback((nextList) => {
    const uniqueNext = Array.from(new Set(nextList || []));
    const currentSet = new Set(selectedGroupIds);
    const added = uniqueNext.filter((id) => !currentSet.has(id));
    const removed = selectedGroupIds.filter((id) => !uniqueNext.includes(id));

    if (added.length) {
      const addedMembers = new Set();
      added.forEach((gid) => {
        const group = groupMap.get(gid);
        (group?.memberIds || []).forEach((mid) => addedMembers.add(mid));
      });
      if (addedMembers.size) {
        setExcludedMemberIds((prev) => prev.filter((mid) => !addedMembers.has(mid)));
      }
    }

    if (removed.length) {
      const removedMembers = new Set();
      removed.forEach((gid) => {
        const group = groupMap.get(gid);
        (group?.memberIds || []).forEach((mid) => removedMembers.add(mid));
      });
      if (removedMembers.size) {
        setExcludedMemberIds((prev) => prev.filter((mid) => !removedMembers.has(mid)));
      }
    }

    setSelectedGroupIds(uniqueNext);
  }, [selectedGroupIds, groupMap]);

  const handleMembersChange = useCallback((nextList) => {
    const uniqueNext = Array.from(new Set(nextList || []));
    const removed = manualMemberIds.filter((id) => !uniqueNext.includes(id));

    setManualMemberIds(uniqueNext);
    setExcludedMemberIds((prev) => {
      const set = new Set(prev);
      uniqueNext.forEach((id) => set.delete(id));
      removed.forEach((id) => {
        const inGroup = selectedGroupIds.some((gid) => {
          const group = groupMap.get(gid);
          return (group?.memberIds || []).includes(id);
        });
        if (inGroup) set.add(id);
        else set.delete(id);
      });
      return Array.from(set);
    });
  }, [manualMemberIds, selectedGroupIds, groupMap]);

  const handleRemoveMember = useCallback((memberId) => {
    setManualMemberIds((prev) => prev.filter((id) => id !== memberId));
    setExcludedMemberIds((prev) => {
      const set = new Set(prev);
      const inGroup = selectedGroupIds.some((gid) => {
        const group = groupMap.get(gid);
        return (group?.memberIds || []).includes(memberId);
      });
      if (inGroup) set.add(memberId);
      else set.delete(memberId);
      return Array.from(set);
    });
  }, [selectedGroupIds, groupMap]);

  const handleTitleBlur = useCallback(async () => {
    const next = (title || "").trim();
    if (!cartId || !next || next === lastSavedTitle.current) return;
    try {
      setLoading(true);
      await cartDbService.updateCartTitle(cartId, next);
      lastSavedTitle.current = next;
    } catch (e) {
      setErr(e?.message || "Failed to update title.");
    } finally {
      setLoading(false);
    }
  }, [cartId, title]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }, [shareUrl]);

  const persistMembers = useCallback(async (id) => {
    await cartDbService.setCartMembers(id, finalMemberIds);
    setMembersSuccess(true);
    setTimeout(() => setMembersSuccess(false), 1600);
  }, [finalMemberIds]);

  const ensureCartThenSaveMembers = useCallback(async () => {
    setMembersErr("");
    setMembersSuccess(false);
    try {
      setSavingMembers(true);
      const id = await handleCreateIfNeeded();
      await persistMembers(id);
      setCartId(id);
    } catch (e) {
      setMembersErr(e?.message || "Failed to save members.");
    } finally {
      setSavingMembers(false);
    }
  }, [handleCreateIfNeeded, persistMembers]);

  const handleGenerateLink = useCallback(async () => {
    setErr("");
    setMembersErr("");
    try {
      setLoading(true);
      const id = await handleCreateIfNeeded();

      const safeTitle = (title?.trim() || restaurant?.name || "Team Cart");
      if (safeTitle !== lastSavedTitle.current) {
        await cartDbService.updateCartTitle(id, safeTitle);
        lastSavedTitle.current = safeTitle;
      }

      await persistMembers(id);
    } catch (e) {
      const msg = e?.message || "Could not create the cart.";
      setErr(msg);
      setMembersErr(msg);
    } finally {
      setLoading(false);
    }
  }, [handleCreateIfNeeded, title, restaurant?.name, persistMembers]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[1400] bg-black/40 p-4 sm:p-6 md:p-8" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-lg bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Share Cart"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 md:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Icon name="Share" size={18} />
            <span>Share Cart</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 pb-20 md:pb-10">
          {err && <div className="text-sm text-destructive">{err}</div>}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cart Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
              placeholder={cartTitle ? `${restaurant?.name ?? ""}` : "Team Cart"}
            />
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Share link</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                placeholder="Generate a shareable link →"
                className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground/90"
              />
              {!cartId ? (
                <Button
                  onClick={handleGenerateLink}
                  disabled={loading || !activeTeam?.id || !restaurant?.id}
                >
                  {loading ? "Generating…" : "Generate Link"}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Copy link"
                  aria-label="Copy link"
                  onClick={handleCopy}
                >
                  <Icon name={copied ? "Check" : "Copy"} size={16} />
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Make sure everyone you share this with is in your team members roster.
            </p>
          </div>

          <div className="border border-border rounded-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="Users" size={16} />
                <span>Add recipients</span>
              </div>
              <div className="flex items-center gap-1 text-xs bg-muted rounded-full p-1">
                <button
                  type="button"
                  className={`px-2 py-1 rounded-full transition ${selectionMode === "groups" ? "bg-background shadow" : "text-muted-foreground"}`}
                  onClick={() => setSelectionMode("groups")}
                >
                  Groups
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 rounded-full transition ${selectionMode === "members" ? "bg-background shadow" : "text-muted-foreground"}`}
                  onClick={() => setSelectionMode("members")}
                >
                  Members
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">
              {membersErr && <div className="text-xs text-destructive">{membersErr}</div>}

              {selectionMode === "groups" ? (
                <Select
                  multiple
                  value={selectedGroupIds}
                  options={groupOptions}
                  onChange={handleGroupsChange}
                  searchable
                  placeholder={groupsLoading ? "Loading groups..." : "Search and add groups"}
                  disabled={groupsLoading || !activeTeam?.id}
                  selectedNoun="groups"
                  menuPosition="fixed"
                />
              ) : (
                <Select
                  multiple
                  value={manualMemberIds}
                  options={memberOptions}
                  onChange={handleMembersChange}
                  searchable
                  placeholder={membersLoading ? "Loading members..." : "Search and add members"}
                  disabled={membersLoading || !activeTeam?.id}
                  selectedNoun="members"
                  groupBy="roleGroup"
                  groupConfig={{ fallbackLabel: "Other", order: orderRoles }}
                  menuPosition="fixed"
                />
              )}

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Selected members ({selectedMembers.length})
                </div>
                {selectedMembers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No members selected yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs"
                      >
                        <span>{member.full_name || member.email || "Member"}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Icon name="X" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 border-t border-border bg-card flex items-center justify-between gap-2">
          {membersSuccess && <div className="text-xs text-emerald-600">Recipients saved</div>}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={ensureCartThenSaveMembers}
            disabled={savingMembers || loading || !activeTeam?.id}
          >
            {savingMembers ? "Saving…" : "Save Members"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
