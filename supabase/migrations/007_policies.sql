-- supabase/migrations/007_policies
-- RLS Policies
-- Pattern 1: Core user table (user_profiles)
-- Read own profile
CREATE POLICY "users_read_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Update own profile (lets them change phone etc.)
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Insert via backend only (trigger/upsert path)
CREATE POLICY "system_insert_profiles"
ON public.user_profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- Pattern 2: Team-based access for teams
CREATE POLICY "team_members_view_teams"
ON public.teams
FOR SELECT
TO authenticated
USING (public.is_team_member(id) OR coach_id = auth.uid());

CREATE POLICY "coaches_manage_teams"
ON public.teams
FOR ALL TO authenticated
USING (public.is_team_coach(id) OR coach_id = auth.uid())
WITH CHECK (public.is_team_coach(id) OR coach_id = auth.uid());

-- Pattern 2: Team membership management
CREATE POLICY "team_members_view_memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "coaches_manage_memberships"
ON public.team_members
FOR ALL
TO authenticated
USING (public.is_team_admin(team_id))
WITH CHECK (public.is_team_admin(team_id));

DROP POLICY IF EXISTS "member_groups_team_read"    ON public.member_groups;
CREATE POLICY "member_groups_team_read"
ON public.member_groups
FOR SELECT TO authenticated
USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS "member_groups_coach_insert" ON public.member_groups;
DROP POLICY IF EXISTS "member_groups_coach_update" ON public.member_groups;
DROP POLICY IF EXISTS "member_groups_coach_delete" ON public.member_groups;

CREATE POLICY "member_groups_coach_insert"
ON public.member_groups
FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "member_groups_coach_update"
ON public.member_groups
FOR UPDATE TO authenticated
USING     (public.is_team_coach(team_id) OR public.is_team_admin(team_id))
WITH CHECK(public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "member_groups_coach_delete"
ON public.member_groups
FOR DELETE TO authenticated
USING (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

-- Membership table:
-- Read: any member of the team the group belongs to
-- Write: coach/admin of that team
DROP POLICY IF EXISTS "mgm_team_read"    ON public.member_group_members;
DROP POLICY IF EXISTS "mgm_coach_insert" ON public.member_group_members;
DROP POLICY IF EXISTS "mgm_coach_update" ON public.member_group_members;
DROP POLICY IF EXISTS "mgm_coach_delete" ON public.member_group_members;

CREATE POLICY "mgm_team_read"
ON public.member_group_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.member_groups g
    WHERE g.id = member_group_members.group_id
      AND public.is_team_member(g.team_id)
  )
);

CREATE POLICY "mgm_coach_insert"
ON public.member_group_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.member_groups g
    WHERE g.id = member_group_members.group_id
      AND (public.is_team_coach(g.team_id) OR public.is_team_admin(g.team_id))
  )
);

CREATE POLICY "mgm_coach_update"
ON public.member_group_members
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.member_groups g
    WHERE g.id = member_group_members.group_id
      AND (public.is_team_coach(g.team_id) OR public.is_team_admin(g.team_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.member_groups g
    WHERE g.id = member_group_members.group_id
      AND (public.is_team_coach(g.team_id) OR public.is_team_admin(g.team_id))
  )
);

CREATE POLICY "mgm_coach_delete"
ON public.member_group_members
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.member_groups g
    WHERE g.id = member_group_members.group_id
      AND (public.is_team_coach(g.team_id) OR public.is_team_admin(g.team_id))
  )
);

-- ------------------------------
-- RESTAURANTS (RLS)
-- ------------------------------

create policy "restaurants_read_via_orders_or_carts"
on public.restaurants
for select
to authenticated
using (
  exists (
    select 1
    from public.meal_orders mo
    where mo.restaurant_id = restaurants.id
      and public.is_team_member(mo.team_id)
  )
  or exists (
    select 1
    from public.meal_carts c
    where c.restaurant_id = restaurants.id
      and public.is_team_member(c.team_id)
  )
);

-- ------------------------------
-- MENU ITEMS (RLS)
-- ------------------------------

create policy "menu_items_read_via_orders_or_carts"
on public.menu_items
for select
to authenticated
using (
  exists (
    select 1
    from public.meal_orders mo
    where mo.restaurant_id = menu_items.restaurant_id
      and public.is_team_member(mo.team_id)
  )
  or exists (
    select 1
    from public.meal_carts c
    where c.restaurant_id = menu_items.restaurant_id
      and public.is_team_member(c.team_id)
  )
);


CREATE POLICY "team_members_read_payment_methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

CREATE POLICY "payment_methods_coach_insert"
ON public.payment_methods
FOR INSERT TO authenticated
WITH CHECK (public.is_team_admin(team_id));

CREATE POLICY "payment_methods_coach_update"
ON public.payment_methods
FOR UPDATE TO authenticated
USING     (public.is_team_admin(team_id))
WITH CHECK(public.is_team_admin(team_id));

CREATE POLICY "payment_methods_coach_delete"
ON public.payment_methods
FOR DELETE TO authenticated
USING (public.is_team_admin(team_id));


-- WRITE: creator or any coach/admin
CREATE POLICY "meal_orders_insert_creator_or_coach"
ON public.meal_orders
FOR INSERT TO authenticated
WITH CHECK (
  (created_by = auth.uid() AND public.is_team_member(team_id))
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
);

CREATE POLICY "meal_orders_update_creator_or_coach"
ON public.meal_orders
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
)
WITH CHECK (
  (created_by = auth.uid() AND public.is_team_member(team_id))
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
);

CREATE POLICY "meal_orders_delete_creator_or_coach"
ON public.meal_orders
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
);

CREATE POLICY "team_members_read_orders"
ON public.meal_orders
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));


-- meal_order_items
DROP POLICY IF EXISTS "team_members_manage_meal_order_items" ON public.meal_order_items;

CREATE POLICY "meal_order_items_team_read"
ON public.meal_order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_orders mo
    WHERE mo.id = meal_order_items.order_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "meal_order_items_insert_coach"
ON public.meal_order_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_items_update_coach"
ON public.meal_order_items
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_items_delete_coach"
ON public.meal_order_items
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

-- meal_order_item_customizations
CREATE POLICY "meal_order_item_customizations_team_read"
ON public.meal_order_item_customizations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_order_items i
    JOIN public.meal_orders mo ON mo.id = i.order_id
    WHERE i.id = meal_order_item_customizations.order_item_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "meal_order_item_customizations_insert_coach"
ON public.meal_order_item_customizations
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_customizations_update_coach"
ON public.meal_order_item_customizations
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_customizations_delete_coach"
ON public.meal_order_item_customizations
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));
-- meal_order_item_options
CREATE POLICY "meal_order_item_options_team_read"
ON public.meal_order_item_options
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_order_item_customizations c
    JOIN public.meal_order_items i ON i.id = c.order_item_id
    JOIN public.meal_orders mo ON mo.id = i.order_id
    WHERE c.id = meal_order_item_options.customization_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "meal_order_item_options_insert_coach"
ON public.meal_order_item_options
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_options_update_coach"
ON public.meal_order_item_options
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_options_delete_coach"
ON public.meal_order_item_options
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

-- Team can read polls
CREATE POLICY "meal_polls_team_read"
ON public.meal_polls
FOR SELECT TO authenticated
USING (public.is_team_member(team_id));

-- Only coaches/admin can write
CREATE POLICY "meal_polls_coach_insert"
ON public.meal_polls
FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "meal_polls_coach_update"
ON public.meal_polls
FOR UPDATE TO authenticated
USING     (public.is_team_coach(team_id) OR public.is_team_admin(team_id))
WITH CHECK(public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "meal_polls_coach_delete"
ON public.meal_polls
FOR DELETE TO authenticated
USING (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "team_members_view_poll_options"
ON public.poll_options
FOR SELECT
TO authenticated
USING (public.is_team_member((SELECT team_id FROM public.meal_polls WHERE id = poll_id)));

CREATE POLICY "coaches_manage_poll_options"
ON public.poll_options
FOR ALL
TO authenticated
USING (public.is_team_admin((SELECT team_id FROM public.meal_polls WHERE id = poll_id)))
WITH CHECK (public.is_team_admin((SELECT team_id FROM public.meal_polls WHERE id = poll_id)));

-- Players see their own vote
CREATE POLICY "poll_votes_select_own"
ON public.poll_votes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Coaches see all votes for their team’s polls
CREATE POLICY "poll_votes_select_coach"
ON public.poll_votes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_polls p
    WHERE p.id = poll_votes.poll_id
      AND (public.is_team_coach(p.team_id) OR public.is_team_admin(p.team_id))
  )
);

-- Players can cast a vote while the poll is active, on their own team,
-- and only if their role is allowed by target_roles
CREATE POLICY "poll_votes_insert_own_active"
ON public.poll_votes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.meal_polls p
    JOIN public.team_members tm
      ON tm.team_id = p.team_id
     AND tm.user_id = auth.uid()
     AND tm.is_active
    WHERE p.id = poll_votes.poll_id
      AND p.poll_status = 'active'
      AND p.expires_at > NOW()
      AND tm.role = ANY (p.target_roles)
  )
);

-- Players can change their vote (same conditions as insert)
CREATE POLICY "poll_votes_update_own_active"
ON public.poll_votes
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.meal_polls p
    JOIN public.team_members tm
      ON tm.team_id = p.team_id
     AND tm.user_id = auth.uid()
     AND tm.is_active
    WHERE p.id = poll_votes.poll_id
      AND p.poll_status = 'active'
      AND p.expires_at > NOW()
      AND tm.role = ANY (p.target_roles)
  )
);

-- Coaches can delete bad/duplicate votes
CREATE POLICY "poll_votes_delete_coach"
ON public.poll_votes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_polls p
    WHERE p.id = poll_votes.poll_id
      AND (public.is_team_coach(p.team_id) OR public.is_team_admin(p.team_id))
  )
);

-- RLS for api_integrations 
CREATE POLICY "service_role_manage_api_integrations"
ON public.api_integrations
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- RLS NOTIFICATIONS
-- Allow team members to read notifications for their team
create policy "team_members_can_select_notifications"
on public.notifications
for select
to authenticated
using (
  -- must be an active member of the team
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = notifications.team_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  )
  -- and if it's a birthday reminder, don't show it to the sender
  and not (
    notifications.type = 'birthday_reminder'
    and notifications.created_by is not distinct from auth.uid()
  )
);

-- Allow coaches to insert birthday reminders for their team
-- (adjust roles if you only use 'coach')
create policy "coach can insert notification"
on public.notifications
for insert
to authenticated
with check ( public.is_a_coach(team_id) );


CREATE POLICY "team_members_mark_notifications_read"
ON public.notifications FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_members tm
               WHERE tm.team_id = notifications.team_id
                 AND tm.user_id = auth.uid() AND tm.is_active));




CREATE POLICY "order_events_team_read"
ON public.order_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_orders mo
    WHERE mo.id = order_events.order_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "order_events_coach_insert"
ON public.order_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.meal_orders mo
    WHERE mo.id = order_events.order_id
      AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
  )
);

CREATE POLICY "order_events_service_all"
ON public.order_events
FOR ALL TO service_role
USING (TRUE) WITH CHECK (TRUE);


-- ------ meal_carts ------
DROP POLICY IF EXISTS meal_carts_select ON public.meal_carts;
CREATE POLICY meal_carts_select
  ON public.meal_carts
  FOR SELECT
  TO authenticated
  USING (
    public.is_member_of_cart(id)
    OR public.is_coach_of_team(team_id)
  );

DROP POLICY IF EXISTS meal_carts_select_for_team_readonly ON public.meal_carts;
CREATE POLICY meal_carts_select_for_team_readonly
  ON public.meal_carts
  FOR SELECT
  TO authenticated
  USING ( public.is_team_member(team_id) );


DROP POLICY IF EXISTS meal_carts_insert ON public.meal_carts;
CREATE POLICY meal_carts_insert
  ON public.meal_carts
  FOR INSERT
  WITH CHECK (
    -- must be a team member (coach or player) to create a cart for that team
    EXISTS (
      SELECT 1 FROM public.team_members tm
       WHERE tm.team_id = meal_carts.team_id
         AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS meal_carts_update ON public.meal_carts;
CREATE POLICY meal_carts_update
  ON public.meal_carts
  FOR UPDATE
  USING (
    -- editable if you are member of cart OR coach of team
    public.is_member_of_cart(id) OR public.is_coach_of_team(team_id)
  )
  WITH CHECK (
    public.is_member_of_cart(id) OR public.is_coach_of_team(team_id)
  );

-- ------ meal_cart_members ------
DROP POLICY IF EXISTS cart_members_select ON public.meal_cart_members;
CREATE POLICY cart_members_select
  ON public.meal_cart_members
  FOR SELECT
  USING (
    public.is_member_of_cart(cart_id)
    OR public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = cart_id) )
  );

-- Only coaches or cart owners can add members (you can relax this if you want)
DROP POLICY IF EXISTS cart_members_insert ON public.meal_cart_members;
CREATE POLICY cart_members_insert
  ON public.meal_cart_members
  FOR INSERT
  WITH CHECK (
    -- coach of the team OR the cart owner
    public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = meal_cart_members.cart_id) )
    OR EXISTS (
      SELECT 1
        FROM public.meal_carts c
       WHERE c.id = meal_cart_members.cart_id
         AND c.created_by_member_id = (
           SELECT tm.id FROM public.team_members tm
            WHERE tm.user_id = auth.uid()
              AND tm.team_id = c.team_id
           LIMIT 1
         )
    )
  );

DROP POLICY IF EXISTS cart_members_delete ON public.meal_cart_members;
CREATE POLICY cart_members_delete
  ON public.meal_cart_members
  FOR DELETE
  USING (
    public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = meal_cart_members.cart_id) )
    OR EXISTS (
      SELECT 1
        FROM public.meal_carts c
       WHERE c.id = meal_cart_members.cart_id
         AND c.created_by_member_id = (
           SELECT tm.id FROM public.team_members tm
            WHERE tm.user_id = auth.uid()
              AND tm.team_id = c.team_id
           LIMIT 1
         )
    )
  );

-- ------ meal_cart_items ------
-- SELECT: cart member OR coach of the team
DROP POLICY IF EXISTS cart_items_select ON public.meal_cart_items;
CREATE POLICY cart_items_select
  ON public.meal_cart_items
  FOR SELECT
  USING (
    public.is_member_of_cart(cart_id)
    OR public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = cart_id) )
  );

-- INSERT: any cart member; cart must be draft.
DROP POLICY IF EXISTS cart_items_insert ON public.meal_cart_items;
CREATE POLICY cart_items_insert
  ON public.meal_cart_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.meal_carts c
       WHERE c.id = meal_cart_items.cart_id
         AND c.status = 'draft'
    )
    AND public.is_member_of_cart(meal_cart_items.cart_id)
  );

-- UPDATE: cart is draft AND (you own it OR you're a coach)
DROP POLICY IF EXISTS cart_items_update ON public.meal_cart_items;
CREATE POLICY cart_items_update
  ON public.meal_cart_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.meal_carts c WHERE c.id = cart_id AND c.status = 'draft')
    AND (
      EXISTS (
        SELECT 1
          FROM public.team_members tm
         WHERE tm.id = meal_cart_items.added_by_member_id
           AND tm.user_id = auth.uid()
      )
      OR public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = cart_id) )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.meal_carts c WHERE c.id = cart_id AND c.status = 'draft')
    AND (
      EXISTS (
        SELECT 1
          FROM public.team_members tm
         WHERE tm.id = meal_cart_items.added_by_member_id
           AND tm.user_id = auth.uid()
      )
      OR public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = cart_id) )
    )
  );

-- DELETE: cart is draft AND (you own it OR you're a coach)
DROP POLICY IF EXISTS cart_items_delete ON public.meal_cart_items;
CREATE POLICY cart_items_delete
  ON public.meal_cart_items
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.meal_carts c WHERE c.id = cart_id AND c.status = 'draft')
    AND (
      EXISTS (
        SELECT 1
          FROM public.team_members tm
         WHERE tm.id = meal_cart_items.added_by_member_id
           AND tm.user_id = auth.uid()
      )
      OR public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c WHERE c.id = cart_id) )
    )
  );

-- ------ meal_cart_item_assignees ------
-- SELECT: cart member or coach
DROP POLICY IF EXISTS item_assignees_select ON public.meal_cart_item_assignees;
CREATE POLICY item_assignees_select
  ON public.meal_cart_item_assignees
  FOR SELECT
  USING (
    public.is_member_of_cart( (SELECT cart_id FROM public.meal_cart_items i WHERE i.id = cart_item_id) )
    OR public.is_coach_of_team( (SELECT team_id FROM public.meal_carts c JOIN public.meal_cart_items i ON i.cart_id = c.id WHERE i.id = cart_item_id) )
  );

-- INSERT: cart is draft AND (you own the item OR you’re a coach)
DROP POLICY IF EXISTS item_assignees_insert ON public.meal_cart_item_assignees;
CREATE POLICY item_assignees_insert
  ON public.meal_cart_item_assignees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meal_carts c
      JOIN public.meal_cart_items i ON i.cart_id = c.id
     WHERE i.id = meal_cart_item_assignees.cart_item_id
       AND c.status = 'draft'
    )
    AND (
      -- owner
      EXISTS (
        SELECT 1
          FROM public.meal_cart_items i
          JOIN public.team_members tm ON tm.id = i.added_by_member_id
         WHERE i.id = meal_cart_item_assignees.cart_item_id
           AND tm.user_id = auth.uid()
      )
      OR
      -- coach on that team
      public.is_coach_of_team(
        (SELECT c.team_id
           FROM public.meal_carts c
           JOIN public.meal_cart_items i ON i.cart_id = c.id
          WHERE i.id = meal_cart_item_assignees.cart_item_id)
      )
    )
  );

-- UPDATE: same as insert (draft AND owner or coach)
DROP POLICY IF EXISTS item_assignees_update ON public.meal_cart_item_assignees;
CREATE POLICY item_assignees_update
  ON public.meal_cart_item_assignees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.meal_carts c
      JOIN public.meal_cart_items i ON i.cart_id = c.id
     WHERE i.id = meal_cart_item_assignees.cart_item_id
       AND c.status = 'draft'
    )
    AND (
      EXISTS (
        SELECT 1
          FROM public.meal_cart_items i
          JOIN public.team_members tm ON tm.id = i.added_by_member_id
         WHERE i.id = meal_cart_item_assignees.cart_item_id
           AND tm.user_id = auth.uid()
      )
      OR public.is_coach_of_team(
        (SELECT c.team_id
           FROM public.meal_carts c
           JOIN public.meal_cart_items i ON i.cart_id = c.id
          WHERE i.id = meal_cart_item_assignees.cart_item_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meal_carts c
      JOIN public.meal_cart_items i ON i.cart_id = c.id
     WHERE i.id = meal_cart_item_assignees.cart_item_id
       AND c.status = 'draft'
    )
    AND (
      EXISTS (
        SELECT 1
          FROM public.meal_cart_items i
          JOIN public.team_members tm ON tm.id = i.added_by_member_id
         WHERE i.id = meal_cart_item_assignees.cart_item_id
           AND tm.user_id = auth.uid()
      )
      OR public.is_coach_of_team(
        (SELECT c.team_id
           FROM public.meal_carts c
           JOIN public.meal_cart_items i ON i.cart_id = c.id
          WHERE i.id = meal_cart_item_assignees.cart_item_id)
      )
    )
  );

-- DELETE: same as update
DROP POLICY IF EXISTS item_assignees_delete ON public.meal_cart_item_assignees;
CREATE POLICY item_assignees_delete
  ON public.meal_cart_item_assignees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.meal_carts c
      JOIN public.meal_cart_items i ON i.cart_id = c.id
     WHERE i.id = meal_cart_item_assignees.cart_item_id
       AND c.status = 'draft'
    )
    AND (
      EXISTS (
        SELECT 1
          FROM public.meal_cart_items i
          JOIN public.team_members tm ON tm.id = i.added_by_member_id
         WHERE i.id = meal_cart_item_assignees.cart_item_id
           AND tm.user_id = auth.uid()
      )
      OR public.is_coach_of_team(
        (SELECT c.team_id
           FROM public.meal_carts c
           JOIN public.meal_cart_items i ON i.cart_id = c.id
          WHERE i.id = meal_cart_item_assignees.cart_item_id)
      )
    )
  );

-- Carts: allow team members to delete their team’s carts
CREATE POLICY cart_delete_for_team
ON public.meal_carts
FOR DELETE
USING (
  team_id IN (
    SELECT tm.team_id
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
  )
);

-- Items: allow delete when the parent cart belongs to user’s team
CREATE POLICY cart_items_delete_via_cart
ON public.meal_cart_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_carts c
    JOIN public.team_members tm ON tm.team_id = c.team_id
    WHERE c.id = meal_cart_items.cart_id
      AND tm.user_id = auth.uid()
  )
);

-- Assignees: allow delete when the parent item belongs to a cart in user’s team
CREATE POLICY cart_item_assignees_delete_via_cart
ON public.meal_cart_item_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_cart_items i
    JOIN public.meal_carts c ON c.id = i.cart_id
    JOIN public.team_members tm ON tm.team_id = c.team_id
    WHERE i.id = meal_cart_item_assignees.cart_item_id
      AND tm.user_id = auth.uid()
      AND c.status <> 'submitted'
  )
);

/* If meal_cart_members exists and should cascade/delete as well: */
CREATE POLICY cart_members_delete_via_cart
ON public.meal_cart_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_carts c
    JOIN public.team_members tm ON tm.team_id = c.team_id
    WHERE c.id = meal_cart_members.cart_id
      AND tm.user_id = auth.uid()
  )
);
