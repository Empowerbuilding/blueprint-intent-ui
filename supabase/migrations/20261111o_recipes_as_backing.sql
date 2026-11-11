-- KINDS OF WORK: three recipes become the backing of their kinds (Tony ruling 2026-11-11 20:56Z, decision 2; audit of flag 37).
-- A measured read-back on a real project is proven and is backing. site.modify, plumbing.niche and roof.modify name a
-- sketch command that is believed broken; each has a recipe that ran. The recipe is recorded with its receipts and
-- revit.invoke_method is added to the commands the kind uses. Named commands are NOT removed (the broken one stays named,
-- with its note). site.fence: the rule for choosing between its two recipes is written on the kind.

update public.intent_kinds
set backing = 'recipe',
    recipe = $v${"summary":"A driveway or pad is cut out of the terrain as its own piece: split the terrain solid along the drawn outline, or make a sub-division on it, then give the piece its own type or material and redo the joins, hides and view overrides the split piece lost.","calls":["Autodesk.Revit.DB.Toposolid.Split(boundary) on the parent terrain solid","Toposolid.CreateSubDivision(doc, IList<CurveLoop>) on the parent terrain solid","duplicate type or set the Material parameter on the piece","redo joins, hides and view overrides on the new piece"],"receipts":[{"project":"Patel","script":"exports/patel/s13_4.py","date":"2026-11-10","check":"driveway piece split from the terrain along the site plan region and joined to the house foundation; 117 ground heights measured before and after, unchanged; saved. Not a build-phase check"},{"project":"693 Rancho","script":"script not pinned (memory 2026-11-05)","date":"2026-11-05","check":"3 sub-divisions (road, parking, house pad); height range read back for each; saved. Not a build-phase check"}],"proven":true,"proven_note":"Proven by its own measured read-back on a real project (ruling 2026-11-11). It has not passed a build-phase check yet."}$v$::jsonb,
    status_note = $v$The named sketch command is believed broken on this build; the recipe is the working path. Caution: on Patel a Revit crash followed about 190 single-point terrain edits in 25 minutes (cause not proven), so point edits are batched.$v$,
    bridge_commands = case when bridge_commands @> '["revit.invoke_method"]'::jsonb then bridge_commands else bridge_commands || '["revit.invoke_method"]'::jsonb end
where kind = 'site.modify' and backing = 'command';

update public.intent_kinds
set backing = 'recipe',
    recipe = $v${"summary":"A recessed niche is a generic-model family with a void and tile liner panels. It is placed on the wall and its void is cut into the stud wall and the tile wall.","calls":["family editor through invoke_method: void, liner panels, load into the project","place_family_instance","SolidSolidCutUtils.AddCutBetweenSolids(doc, wall, niche) for each wall it cuts"],"receipts":[{"project":"Whitaker","script":"exports/whitaker/s7a_lib.py","date":"2026-11-09","check":"build phase P7A done: 3 recessed niches cutting the stud wall and the tile wall, wall volume drop verified for each"},{"project":"Deubner","script":"exports/deubner/ni1.py","date":"2026-11-08","check":"niches rebuilt as real void cuts; wall volume read before and after each cut; saved"}],"proven":true,"proven_note":null}$v$::jsonb,
    status_note = $v$Built by a recipe: a niche family with a void, cut into the walls. Of its two named commands one is believed broken on this build and the other has never been run.$v$,
    bridge_commands = case when bridge_commands @> '["revit.invoke_method"]'::jsonb then bridge_commands else bridge_commands || '["revit.invoke_method"]'::jsonb end
where kind = 'plumbing.niche' and backing = 'command';

update public.intent_kinds
set backing = 'recipe',
    recipe = $v${"summary":"Move the existing outline lines of a roof one at a time inside a sketch edit. The line ids are kept, so dimensions on them survive. Adding or removing an outline segment has not been tried.","calls":["SketchEditScope over reflection (exports/patel/sk_lib.py)","CurveElement.SetGeometryCurve for each moved line"],"receipts":[{"project":"Patel","script":"exports/patel/p1c.py (library exports/patel/sk_lib.py)","date":"2026-11-09","check":"north eave of one roof moved 2 ft; roof bounding box read before and after; saved. Not a build-phase check"}],"proven":true,"proven_note":"Proven by its own measured read-back on a real project (ruling 2026-11-11). It has not passed a build-phase check yet."}$v$::jsonb,
    status_note = $v$Moving the existing outline lines of a roof is done by a recipe. The named sketch command is believed broken on this build. Adding or removing an outline segment has not been tried by any path.$v$,
    bridge_commands = case when bridge_commands @> '["revit.invoke_method"]'::jsonb then bridge_commands else bridge_commands || '["revit.invoke_method"]'::jsonb end
where kind = 'roof.modify' and backing = 'command';

update public.intent_kinds set status_note = $v$Two recipes have run, each measured by its own script. Rule: a flat host under the fence line (pad, slab, floor) takes the fence wall type; open ground takes a railing hosted on the terrain. Where that cannot be told, a person decides and the default is the wall type.$v$ where kind = 'site.fence';
