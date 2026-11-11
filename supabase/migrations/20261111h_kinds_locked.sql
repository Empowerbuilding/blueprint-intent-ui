-- KINDS OF WORK: two tiers (Tony / Mitch ruling 2026-11-11 08:34Z).
--   LOCKED = every bridge command the kind names is on the live bridge's command list (build f98f724, read 2026-11-11 08:16Z)
--            AND its parameters were read from the bridge source at that commit. It does NOT mean a command was run.
--   PROVEN = run once on a live model: recorded per command on the Capabilities page, never here.
-- 25 kinds lock; 10 stay draft, each with the reason. The commands each kind names are stored with it.
-- Nothing existing is removed. Contract v1 and v2 are built exactly as before.

alter table public.intent_kinds add column if not exists bridge_commands jsonb not null default '[]'::jsonb;
alter table public.intent_kinds add column if not exists locked_build text;
alter table public.intent_kinds add column if not exists locked_at timestamptz;
alter table public.intent_kinds add column if not exists status_note text;

update public.intent_kinds set status = 'locked', bridge_commands = '["revit.place_window","revit.place_door","revit.place_family_instance","revit.place_family_on_face"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'opening.place';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.replace_family","revit.swap_family_type","revit.flip_door"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'opening.replace';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.move_element","revit.rotate_element","revit.edit_sketch_boundary","revit.set_parameter_value","revit.cut_geometry"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = $v$One command it names, editing a sketch outline, is believed broken on this build.$v$ where kind = 'opening.modify';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_room","revit.set_parameter_value"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'room.config';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_room_color_scheme","revit.update_room_color_scheme","revit.apply_color_scheme_to_view"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'room.palette';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.place_family_instance","revit.place_family_on_host","revit.create_family_box"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'casework.place';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.move_element","revit.swap_family_type","revit.set_parameter_value","revit.edit_sketch_boundary"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = $v$One command it names, editing a sketch outline, is believed broken on this build.$v$ where kind = 'casework.modify';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.rehost_element"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'casework.rehost';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.create_family_box","revit.place_family_instance"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: built with the parametric box command; the path is not confirmed.$v$ where kind = 'casework.counter';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.place_family_instance"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'appliance.place';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.place_family_instance","revit.place_family_on_host"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'plumbing.place';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.place_family_instance"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'plumbing.sink';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.cut_geometry","revit.edit_sketch_boundary"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = $v$One command it names, editing a sketch outline, is believed broken on this build.$v$ where kind = 'plumbing.niche';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_floor","revit.set_compound_structure_layers","revit.edit_sketch_boundary"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = $v$One command it names, editing a sketch outline, is believed broken on this build.$v$ where kind = 'surface.floor';
update public.intent_kinds set status = 'draft', bridge_commands = '[]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: the bridge has no command that creates a ceiling.$v$ where kind = 'surface.ceiling';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.create_wall","revit.create_walls","revit.set_wall_height"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: the bridge has no command that snaps a wall to an axis.$v$ where kind = 'surface.wall';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_beam","revit.create_solid_extrusion"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'surface.beam';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_soffit","revit.create_solid_extrusion"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'surface.soffit';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.set_element_material","revit.create_material","revit.set_type_parameter"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'finish.material';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_roof","revit.create_roof_fascia","revit.inspect_roof_sketch","revit.edit_sketch_boundary","revit.attach_walls_to_roof"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = $v$One command it names, editing a sketch outline, is believed broken on this build.$v$ where kind = 'roof.modify';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.create_stairs"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: the bridge can create a stair, but has no command that changes a stair run or its path.$v$ where kind = 'structure.stairs';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.delete_element"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'structure.modify';
update public.intent_kinds set status = 'draft', bridge_commands = '[]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft by design: there is no command for this. A person decides how, each time.$v$ where kind = 'structure.resize';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_foundation"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'structure.foundation';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.edit_sketch_boundary","revit.create_floor"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = $v$One command it names, editing a sketch outline, is believed broken on this build.$v$ where kind = 'site.modify';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.edit_sketch_boundary","revit.cut_geometry"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: no bridge command by name. It would go through editing a sketch outline and cutting geometry.$v$ where kind = 'site.fence';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.edit_sketch_boundary","revit.cut_geometry"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: no bridge command by name. It would go through editing a sketch outline and cutting geometry.$v$ where kind = 'site.pool';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.create_sheet","revit.duplicate_sheet","revit.populate_titleblock","revit.renumber_sheets"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: the bridge has no command that creates a sheet set.$v$ where kind = 'sheet.create';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.create_floor_plan_view","revit.create_ceiling_plan_view","revit.create_elevation_view","revit.create_section_view","revit.create_3d_view","revit.duplicate_view","revit.apply_view_template","revit.set_view_scale","revit.set_view_range","revit.set_view_crop"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'sheet.view';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.place_viewport_on_sheet","revit.tag_all_in_view","revit.tag_element","revit.create_dimension","revit.create_height_dimension","revit.create_text_note","revit.create_tag","revit.set_tag_head_position"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'sheet.annotate';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.create_conduit"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: the bridge has no command that places an outlet or a light; only conduit.$v$ where kind = 'mep.electrical';
update public.intent_kinds set status = 'draft', bridge_commands = '["revit.create_pipe","revit.place_family_instance"]'::jsonb, locked_build = null, locked_at = null, status_note = $v$Draft: pipe routing and fixture placement exist by name; the path is not confirmed.$v$ where kind = 'mep.plumbing';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.check_model_integrity","revit.get_warnings","revit.validate_elements","revit.find_duplicate_elements","revit.check_clashes"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'qa.run';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.export_pdf_by_sheet_set"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'export.pdf';
update public.intent_kinds set status = 'locked', bridge_commands = '["revit.render_3d_view","revit.export_image","revit.export_view_image_base64"]'::jsonb, locked_build = 'f98f724', locked_at = '2026-11-11T08:40:00Z', status_note = null where kind = 'export.render';

do $$
declare n_locked int; n_work int;
begin
  select count(*) into n_locked from public.intent_kinds where status = 'locked' and executable;
  select count(*) into n_work from public.intent_kinds where executable and active;
  raise notice 'kinds of work: %, locked: %', n_work, n_locked;
  if n_locked <> 25 then raise exception 'expected 25 locked kinds, found %', n_locked; end if;
  if exists (select 1 from public.intent_kinds where status = 'locked' and jsonb_array_length(bridge_commands) = 0) then
    raise exception 'a locked kind names no command';
  end if;
end $$;
