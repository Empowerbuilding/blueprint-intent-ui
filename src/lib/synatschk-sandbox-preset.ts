// Auto-generated from live Revit Sandbox Scan (Read-Only)
import type { HouseMatrix } from "./canvas-matrix"

export const SYNATSCHK_SANDBOX_L1_MATRIX: HouseMatrix = {
  "projectId": "sandbox-two-story-l1",
  "projectName": "Synatschk Sandbox \u2014 Level 1 (2,227 sf \u00b7 15 Rooms)",
  "stageLabel": "Sandbox D2 Matrix \u00b7 Level 1.0 (10 Flex Partitions \u00b7 42 Walls)",
  "flexWalls": {
    "fw-l1-5955643": {
      "id": "fw-l1-5955643",
      "label": "Master Bedroom \u2194 Master Bath (17'-0\")",
      "roomAId": "112",
      "roomBId": "113",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5964196": {
      "id": "fw-l1-5964196",
      "label": "Master Bath \u2194 Storage (16'-0\")",
      "roomAId": "113",
      "roomBId": "103",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5964317": {
      "id": "fw-l1-5964317",
      "label": "Bath 2 \u2194 Bed 2 (12'-1\")",
      "roomAId": "110",
      "roomBId": "111",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5968133": {
      "id": "fw-l1-5968133",
      "label": "Bath 2 \u2194 Mud Hall & Lockers (21'-4.5\")",
      "roomAId": "110",
      "roomBId": "118",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5968295": {
      "id": "fw-l1-5968295",
      "label": "Butler's Pantry \u2194 Kitchen (12'-1\")",
      "roomAId": "107",
      "roomBId": "106",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5968759": {
      "id": "fw-l1-5968759",
      "label": "Bed 2 \u2194 Butler's Pantry (12'-1\")",
      "roomAId": "111",
      "roomBId": "107",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5974780": {
      "id": "fw-l1-5974780",
      "label": "Master Closet \u2194 Great Room (6'-2\")",
      "roomAId": "114",
      "roomBId": "104",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5974883": {
      "id": "fw-l1-5974883",
      "label": "Master Closet \u2194 Master Bath (12'-11.5\")",
      "roomAId": "114",
      "roomBId": "113",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5979108": {
      "id": "fw-l1-5979108",
      "label": "Mud Hall & Lockers \u2194 Master Bedroom (15'-4\")",
      "roomAId": "118",
      "roomBId": "112",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-5996742": {
      "id": "fw-l1-5996742",
      "label": "Butler's Pantry \u2194 Hall Closet (4'-11\")",
      "roomAId": "107",
      "roomBId": "120",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-6012573": {
      "id": "fw-l1-6012573",
      "label": "Laundry \u2194 Bath 2 (12'-1\")",
      "roomAId": "109",
      "roomBId": "110",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l1-6020381": {
      "id": "fw-l1-6020381",
      "label": "Storage \u2194 Foyer & Coats (5'-2\")",
      "roomAId": "103",
      "roomBId": "101",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    }
  },
  "rooms": [
    {
      "id": "101",
      "number": "101",
      "name": "Foyer & Coats",
      "subtitle": "10'-0\" Flat Clg \u00b7 Bench, Hooks & Coat Closet",
      "status": "draft",
      "planRect": {
        "xIn": 357.5,
        "yIn": 4.0,
        "widthIn": 172.6,
        "depthIn": 54.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (14'-4.5\" \u00d7 4'-6\" \u00b7 64.7 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-101-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-101-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Foyer & Coats \u2014 North Wall (14'-4.5\")",
          "clearWidthIn": 172.6,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-101-N-1",
              "kind": "door",
              "label": "Double Entry Door",
              "widthIn": 72,
              "heightIn": 96,
              "depthIn": 6,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=72\" \u00b7 H=96\" \u00b7 D=6\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Foyer & Coats \u2014 East Wall (4'-6\")",
          "clearWidthIn": 54.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Foyer & Coats \u2014 South Wall (14'-4.5\")",
          "clearWidthIn": 172.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Foyer & Coats \u2014 West Wall (4'-6\")",
          "clearWidthIn": 54.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-101-W-2",
              "kind": "base_doors",
              "label": "Entry Bench + Hooks",
              "widthIn": 48,
              "heightIn": 84,
              "depthIn": 18,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=84\" \u00b7 D=18\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true,
          "flexBinding": {
            "flexWallId": "fw-l1-6020381",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-5953856-101",
          "wall": "N",
          "offsetIn": 52.5,
          "widthIn": 78,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5959763-101",
          "wall": "S",
          "offsetIn": 39.5,
          "widthIn": 104,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6020460-101",
          "wall": "S",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5981750-101",
          "wall": "N",
          "offsetIn": 22.5,
          "widthIn": 24,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-5981901-101",
          "wall": "N",
          "offsetIn": 136.5,
          "widthIn": 24,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-5997868-101",
          "wall": "E",
          "offsetIn": 14.8,
          "widthIn": 24,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-6020381",
        "role": "shift_west"
      }
    },
    {
      "id": "103",
      "number": "103",
      "name": "Storage",
      "subtitle": "10'-0\" Flat Clg \u00b7 Shelving",
      "status": "draft",
      "planRect": {
        "xIn": 291.8,
        "yIn": 4.0,
        "widthIn": 61.1,
        "depthIn": 54.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (5'-1\" \u00d7 4'-6\" \u00b7 22.9 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-103-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-103-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Storage \u2014 North Wall (5'-1\")",
          "clearWidthIn": 61.1,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-103-N-1",
              "kind": "closet_shelves",
              "label": "Full-Height Shelving",
              "widthIn": 54,
              "heightIn": 96,
              "depthIn": 16,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=54\" \u00b7 H=96\" \u00b7 D=16\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Storage \u2014 East Wall (4'-6\")",
          "clearWidthIn": 54.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Storage \u2014 South Wall (5'-1\")",
          "clearWidthIn": 61.1,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Storage \u2014 West Wall (4'-6\")",
          "clearWidthIn": 54.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5964196",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-6020460-103",
          "wall": "S",
          "offsetIn": 20.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5964196",
        "role": "shift_west"
      }
    },
    {
      "id": "104",
      "number": "104",
      "name": "Great Room",
      "subtitle": "20'-0\" Double-Height Open to Loft \u00b7 Wood Grain Tile",
      "status": "draft",
      "planRect": {
        "xIn": 333.5,
        "yIn": 66.0,
        "widthIn": 378.5,
        "depthIn": 255.5
      },
      "ceilingHeightIn": 240,
      "ceilingLabel": "20'-0\" Ceiling (31'-6.5\" \u00d7 21'-3.5\" \u00b7 671.5 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-104-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-104-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Great Room \u2014 North Wall (31'-6.5\")",
          "clearWidthIn": 378.5,
          "ceilingHeightIn": 240,
          "bays": [
            {
              "id": "bay-104-N-1",
              "kind": "floating_shelves",
              "label": "Thick Floating Shelves + Lower Cab (L)",
              "widthIn": 66,
              "heightIn": 96,
              "depthIn": 18,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=66\" \u00b7 H=96\" \u00b7 D=18\""
            },
            {
              "id": "bay-104-N-2",
              "kind": "fireplace_chase",
              "label": "Wood-Burn Gas-Start Fireplace + Hearth Across + Mantel + TV",
              "widthIn": 70,
              "heightIn": 240,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=70\" \u00b7 H=240\" \u00b7 D=24\""
            },
            {
              "id": "bay-104-N-3",
              "kind": "floating_shelves",
              "label": "Thick Floating Shelves + Lower Cab (R)",
              "widthIn": 66,
              "heightIn": 96,
              "depthIn": 18,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=66\" \u00b7 H=96\" \u00b7 D=18\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Great Room \u2014 East Wall (21'-3.5\")",
          "clearWidthIn": 255.5,
          "ceilingHeightIn": 240,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Great Room \u2014 South Wall (31'-6.5\")",
          "clearWidthIn": 378.5,
          "ceilingHeightIn": 240,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Great Room \u2014 West Wall (21'-3.5\")",
          "clearWidthIn": 255.5,
          "ceilingHeightIn": 240,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5974780",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-5952318-104",
          "wall": "E",
          "offsetIn": 102.0,
          "widthIn": 192,
          "kind": "accordion",
          "swing": "none"
        },
        {
          "id": "op-5959763-104",
          "wall": "N",
          "offsetIn": 63.5,
          "widthIn": 104,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6020460-104",
          "wall": "N",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5975850-104",
          "wall": "E",
          "offsetIn": 34.0,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5974780",
        "role": "shift_west"
      }
    },
    {
      "id": "105",
      "number": "105",
      "name": "Dining",
      "subtitle": "Open to Kitchen & East/South Patios",
      "status": "draft",
      "planRect": {
        "xIn": 576.0,
        "yIn": 256.8,
        "widthIn": 136.0,
        "depthIn": 205.2
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (11'-4\" \u00d7 17'-1\" \u00b7 193.7 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-105-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-105-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Dining \u2014 North Wall (11'-4\")",
          "clearWidthIn": 136.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Dining \u2014 East Wall (17'-1\")",
          "clearWidthIn": 205.2,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Dining \u2014 South Wall (11'-4\")",
          "clearWidthIn": 136.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Dining \u2014 West Wall (17'-1\")",
          "clearWidthIn": 205.2,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-5952318-105",
          "wall": "N",
          "offsetIn": 27.9,
          "widthIn": 192,
          "kind": "accordion",
          "swing": "none"
        },
        {
          "id": "op-5975868-105",
          "wall": "E",
          "offsetIn": 123.2,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        }
      ]
    },
    {
      "id": "106",
      "number": "106",
      "name": "Kitchen",
      "subtitle": "10'-0\" Clg \u00b7 6'-0\" Wood-Wrap Island + Built-In Hood Run",
      "status": "draft",
      "planRect": {
        "xIn": 341.5,
        "yIn": 321.5,
        "widthIn": 234.5,
        "depthIn": 140.5
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (19'-6.5\" \u00d7 11'-8.5\" \u00b7 228.8 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-106-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-106-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Kitchen \u2014 North Wall (19'-6.5\")",
          "clearWidthIn": 234.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Kitchen \u2014 East Wall (11'-8.5\")",
          "clearWidthIn": 140.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Kitchen \u2014 South Wall (19'-6.5\")",
          "clearWidthIn": 234.5,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-106-S-1",
              "kind": "fridge",
              "label": "Column Fridge + Ice Machine",
              "widthIn": 36,
              "heightIn": 108,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=36\" \u00b7 H=108\" \u00b7 D=24\""
            },
            {
              "id": "bay-106-S-2",
              "kind": "drawer_stack",
              "label": "Base Drawers + Upper Cabs (L)",
              "widthIn": 48,
              "heightIn": 36,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=36\" \u00b7 D=24\""
            },
            {
              "id": "bay-106-S-3",
              "kind": "range_hood",
              "label": "48\" Range + Built-In Hood",
              "widthIn": 48,
              "heightIn": 108,
              "depthIn": 26,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "hoodWidthIn": 48,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=108\" \u00b7 D=26\""
            },
            {
              "id": "bay-106-S-4",
              "kind": "drawer_stack",
              "label": "Base Drawers + Upper Cabs (R)",
              "widthIn": 48,
              "heightIn": 36,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=36\" \u00b7 D=24\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Kitchen \u2014 West Wall (11'-8.5\")",
          "clearWidthIn": 140.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5968295",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-5996294-106",
          "wall": "W",
          "offsetIn": 25.7,
          "widthIn": 81,
          "kind": "door",
          "swing": "in-left"
        }
      ],
      "island": {
        "widthIn": 132,
        "depthIn": 72,
        "aisleNorthIn": 48,
        "overhangSouthIn": 15,
        "stoolsCount": 6
      },
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5968295",
        "role": "shift_west"
      }
    },
    {
      "id": "107",
      "number": "107",
      "name": "Butler's Pantry",
      "subtitle": "10'-0\" Clg \u00b7 Butler's Style Build-Out + MW",
      "status": "draft",
      "planRect": {
        "xIn": 282.6,
        "yIn": 369.5,
        "widthIn": 54.4,
        "depthIn": 92.5
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (4'-6.5\" \u00d7 7'-8.5\" \u00b7 34.9 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-107-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-107-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Butler's Pantry \u2014 North Wall (4'-6.5\")",
          "clearWidthIn": 54.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Butler's Pantry \u2014 East Wall (7'-8.5\")",
          "clearWidthIn": 92.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5968295",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Butler's Pantry \u2014 South Wall (4'-6.5\")",
          "clearWidthIn": 54.4,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-107-S-1",
              "kind": "drawer_stack",
              "label": "Butler's Counter + MW + Upper Cabs",
              "widthIn": 54,
              "heightIn": 108,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=54\" \u00b7 H=108\" \u00b7 D=24\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Butler's Pantry \u2014 West Wall (7'-8.5\")",
          "clearWidthIn": 92.5,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-107-W-2",
              "kind": "tall_tower",
              "label": "Pantry Storage Run",
              "widthIn": 84,
              "heightIn": 108,
              "depthIn": 18,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=84\" \u00b7 H=108\" \u00b7 D=18\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        }
      ],
      "planOpenings": [
        {
          "id": "op-5996294-107",
          "wall": "E",
          "offsetIn": 2.0,
          "widthIn": 81,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5996901-107",
          "wall": "N",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5968295",
        "role": "expand_east"
      }
    },
    {
      "id": "108",
      "number": "108",
      "name": "Stairs & Wet Bar",
      "subtitle": "Floating Thick-Tread Stair + Under-Stair Wine/Beverage Bar",
      "status": "draft",
      "planRect": {
        "xIn": 291.8,
        "yIn": 66.0,
        "widthIn": 96.7,
        "depthIn": 190.8
      },
      "ceilingHeightIn": 240,
      "ceilingLabel": "20'-0\" Ceiling (8'-0.5\" \u00d7 15'-11\" \u00b7 128.2 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-108-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-108-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Stairs & Wet Bar \u2014 North Wall (8'-0.5\")",
          "clearWidthIn": 96.7,
          "ceilingHeightIn": 240,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Stairs & Wet Bar \u2014 East Wall (15'-11\")",
          "clearWidthIn": 190.8,
          "ceilingHeightIn": 240,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Stairs & Wet Bar \u2014 South Wall (8'-0.5\")",
          "clearWidthIn": 96.7,
          "ceilingHeightIn": 240,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Stairs & Wet Bar \u2014 West Wall (15'-11\")",
          "clearWidthIn": 190.8,
          "ceilingHeightIn": 240,
          "bays": [
            {
              "id": "bay-108-W-1",
              "kind": "sink_base",
              "label": "Bar Sink + Wine Fridge + UC Fridge + Ice + Open Shelving",
              "widthIn": 96,
              "heightIn": 96,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": true,
              "hasSconces": true,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=96\" \u00b7 H=96\" \u00b7 D=24\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        }
      ],
      "planOpenings": [
        {
          "id": "op-6020460-108",
          "wall": "N",
          "offsetIn": 20.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ]
    },
    {
      "id": "109",
      "number": "109",
      "name": "Laundry",
      "subtitle": "10'-0\" Clg \u00b7 W/D Lifted 18\" + Vanity-Style Sink + Rod",
      "status": "draft",
      "planRect": {
        "xIn": 4.0,
        "yIn": 326.0,
        "widthIn": 76.3,
        "depthIn": 136.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (6'-4.5\" \u00d7 11'-4\" \u00b7 72.1 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-109-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-109-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Laundry \u2014 North Wall (6'-4.5\")",
          "clearWidthIn": 76.3,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Laundry \u2014 East Wall (11'-4\")",
          "clearWidthIn": 136.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-6012573",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Laundry \u2014 South Wall (6'-4.5\")",
          "clearWidthIn": 76.3,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-109-S-3",
              "kind": "sink_base",
              "label": "Laundry Sink ('Like Master Van')",
              "widthIn": 42,
              "heightIn": 36,
              "depthIn": 22,
              "affIn": 0,
              "hasMirror": true,
              "hasSconces": true,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=42\" \u00b7 H=36\" \u00b7 D=22\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Laundry \u2014 West Wall (11'-4\")",
          "clearWidthIn": 136.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-109-W-1",
              "kind": "tall_tower",
              "label": "Washer + Dryer Lifted 18\" on Pedestal",
              "widthIn": 66,
              "heightIn": 96,
              "depthIn": 30,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=66\" \u00b7 H=96\" \u00b7 D=30\""
            },
            {
              "id": "bay-109-W-2",
              "kind": "base_doors",
              "label": "Base + Upper Cabs + Hanging Rod",
              "widthIn": 60,
              "heightIn": 96,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=60\" \u00b7 H=96\" \u00b7 D=24\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        }
      ],
      "planOpenings": [
        {
          "id": "op-6027950-109",
          "wall": "S",
          "offsetIn": 10.1,
          "widthIn": 60,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-6012573",
        "role": "expand_east"
      }
    },
    {
      "id": "110",
      "number": "110",
      "name": "Bath 2",
      "subtitle": "10'-0\" Clg \u00b7 Vanity, WC & Sliding-Glass Tile Shower w/ Niche",
      "status": "draft",
      "planRect": {
        "xIn": 84.8,
        "yIn": 323.4,
        "widthIn": 64.9,
        "depthIn": 138.6
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (5'-5\" \u00d7 11'-6.5\" \u00b7 62.5 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-110-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-110-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Bath 2 \u2014 North Wall (5'-5\")",
          "clearWidthIn": 64.9,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Bath 2 \u2014 East Wall (11'-6.5\")",
          "clearWidthIn": 138.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5964317",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Bath 2 \u2014 South Wall (5'-5\")",
          "clearWidthIn": 64.9,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-110-S-3",
              "kind": "wet_room_glass",
              "label": "Sliding Glass Tile Shower + Niche",
              "widthIn": 60,
              "heightIn": 96,
              "depthIn": 36,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=60\" \u00b7 H=96\" \u00b7 D=36\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Bath 2 \u2014 West Wall (11'-6.5\")",
          "clearWidthIn": 138.6,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-110-W-1",
              "kind": "sink_base",
              "label": "Single Vanity + Mirror + Sconces",
              "widthIn": 36,
              "heightIn": 36,
              "depthIn": 22,
              "affIn": 0,
              "hasMirror": true,
              "hasSconces": true,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=36\" \u00b7 H=36\" \u00b7 D=22\""
            },
            {
              "id": "bay-110-W-2",
              "kind": "toilet_bay",
              "label": "WC Bay",
              "widthIn": 32,
              "heightIn": 36,
              "depthIn": 28,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=32\" \u00b7 H=36\" \u00b7 D=28\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        }
      ],
      "planOpenings": [
        {
          "id": "op-6012128-110",
          "wall": "E",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6012690-110",
          "wall": "N",
          "offsetIn": 25.2,
          "widthIn": 38,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6027816-110",
          "wall": "S",
          "offsetIn": 2.2,
          "widthIn": 60,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5964317",
        "role": "expand_east"
      }
    },
    {
      "id": "111",
      "number": "111",
      "name": "Bed 2",
      "subtitle": "10'-0\" Clg \u00b7 Reach-In Bench + Hanging Closet",
      "status": "draft",
      "planRect": {
        "xIn": 154.3,
        "yIn": 323.4,
        "widthIn": 123.7,
        "depthIn": 138.6
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (10'-3.5\" \u00d7 11'-6.5\" \u00b7 119.1 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-111-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-111-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Bed 2 \u2014 North Wall (10'-3.5\")",
          "clearWidthIn": 123.7,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-111-N-1",
              "kind": "closet_double_hang",
              "label": "Closet Bench + Hanging Above",
              "widthIn": 72,
              "heightIn": 96,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=72\" \u00b7 H=96\" \u00b7 D=24\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Bed 2 \u2014 East Wall (11'-6.5\")",
          "clearWidthIn": 138.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Bed 2 \u2014 South Wall (10'-3.5\")",
          "clearWidthIn": 123.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Bed 2 \u2014 West Wall (11'-6.5\")",
          "clearWidthIn": 138.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5964317",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-5971346-111",
          "wall": "N",
          "offsetIn": 47.6,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5996901-111",
          "wall": "E",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6012128-111",
          "wall": "W",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6006399-111",
          "wall": "S",
          "offsetIn": 6.2,
          "widthIn": 23,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5964317",
        "role": "shift_west"
      }
    },
    {
      "id": "112",
      "number": "112",
      "name": "Master Bedroom",
      "subtitle": "10'-0\" Flat Clg \u00b7 Built-In Tall Cab & Shelves",
      "status": "draft",
      "planRect": {
        "xIn": 4.0,
        "yIn": 66.0,
        "widthIn": 177.6,
        "depthIn": 181.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (14'-9.5\" \u00d7 15'-1\" \u00b7 223.2 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-112-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-112-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Master Bedroom \u2014 North Wall (14'-9.5\")",
          "clearWidthIn": 177.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Master Bedroom \u2014 East Wall (15'-1\")",
          "clearWidthIn": 181.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-112-E-1",
              "kind": "tall_tower",
              "label": "Built-In Tall Cabinet + 10' Shelves",
              "widthIn": 48,
              "heightIn": 120,
              "depthIn": 18,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=120\" \u00b7 D=18\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true,
          "flexBinding": {
            "flexWallId": "fw-l1-5955643",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Master Bedroom \u2014 South Wall (14'-9.5\")",
          "clearWidthIn": 177.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Master Bedroom \u2014 West Wall (15'-1\")",
          "clearWidthIn": 181.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-5971068-112",
          "wall": "S",
          "offsetIn": 134.1,
          "widthIn": 42,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5972339-112",
          "wall": "E",
          "offsetIn": 4.0,
          "widthIn": 42,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5972376-112",
          "wall": "E",
          "offsetIn": 99.9,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6006317-112",
          "wall": "N",
          "offsetIn": 138.1,
          "widthIn": 24,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-6006354-112",
          "wall": "N",
          "offsetIn": 16.1,
          "widthIn": 24,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5955643",
        "role": "expand_east"
      }
    },
    {
      "id": "113",
      "number": "113",
      "name": "Master Bath",
      "subtitle": "10'-0\" Clg \u00b7 Floor-Standing Double Vanity + Glass Shower",
      "status": "draft",
      "planRect": {
        "xIn": 186.0,
        "yIn": 4.0,
        "widthIn": 101.3,
        "depthIn": 186.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (8'-5.5\" \u00d7 15'-6\" \u00b7 130.8 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-113-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-113-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Master Bath \u2014 North Wall (8'-5.5\")",
          "clearWidthIn": 101.3,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-113-N-3",
              "kind": "wet_room_glass",
              "label": "Walk-In Glass Shower (Bench, Niche, Center Drain)",
              "widthIn": 96,
              "heightIn": 108,
              "depthIn": 54,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=96\" \u00b7 H=108\" \u00b7 D=54\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Master Bath \u2014 East Wall (15'-6\")",
          "clearWidthIn": 186.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-113-E-1",
              "kind": "sink_base",
              "label": "Double Vanity to Ground, Sep Mirrors & Lights Between",
              "widthIn": 84,
              "heightIn": 36,
              "depthIn": 22,
              "affIn": 0,
              "hasMirror": true,
              "hasSconces": true,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=84\" \u00b7 H=36\" \u00b7 D=22\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Master Bath \u2014 South Wall (8'-5.5\")",
          "clearWidthIn": 101.3,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-113-S-2",
              "kind": "toilet_bay",
              "label": "Enclosed WC Alcove",
              "widthIn": 36,
              "heightIn": 36,
              "depthIn": 28,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=36\" \u00b7 H=36\" \u00b7 D=28\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Master Bath \u2014 West Wall (15'-6\")",
          "clearWidthIn": 186.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5955643",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-5972376-113",
          "wall": "W",
          "offsetIn": 161.9,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5982037-113",
          "wall": "N",
          "offsetIn": 12.0,
          "widthIn": 76,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5955643",
        "role": "shift_west"
      }
    },
    {
      "id": "114",
      "number": "114",
      "name": "Master Closet",
      "subtitle": "10'-0\" Clg \u00b7 Built-Ins, Double/Long Hang, Cubbies & Drawers",
      "status": "draft",
      "planRect": {
        "xIn": 186.0,
        "yIn": 194.5,
        "widthIn": 151.0,
        "depthIn": 69.5
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (12'-7\" \u00d7 5'-9.5\" \u00b7 72.8 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-114-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-114-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Master Closet \u2014 North Wall (12'-7\")",
          "clearWidthIn": 151.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-114-N-1",
              "kind": "closet_double_hang",
              "label": "North Double Hang + Upper Shelf",
              "widthIn": 96,
              "heightIn": 96,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=96\" \u00b7 H=96\" \u00b7 D=24\""
            },
            {
              "id": "bay-114-N-2",
              "kind": "closet_drawers",
              "label": "Center Cubbies + Drawer Stack",
              "widthIn": 48,
              "heightIn": 96,
              "depthIn": 20,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=96\" \u00b7 D=20\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Master Closet \u2014 East Wall (5'-9.5\")",
          "clearWidthIn": 69.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l1-5974780",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Master Closet \u2014 South Wall (12'-7\")",
          "clearWidthIn": 151.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-114-S-3",
              "kind": "closet_long_hang",
              "label": "South Long Hang + Shoe Tiers",
              "widthIn": 144,
              "heightIn": 96,
              "depthIn": 24,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=144\" \u00b7 H=96\" \u00b7 D=24\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Master Closet \u2014 West Wall (5'-9.5\")",
          "clearWidthIn": 69.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-5972376-114",
          "wall": "W",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l1-5974780",
        "role": "expand_east"
      }
    },
    {
      "id": "118",
      "number": "118",
      "name": "Mud Hall & Lockers",
      "subtitle": "10'-0\" Clg \u00b7 Inspo Bench/Hooks + Tall Broom Cabinet",
      "status": "draft",
      "planRect": {
        "xIn": 4.0,
        "yIn": 251.5,
        "widthIn": 329.5,
        "depthIn": 74.5
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (27'-5.5\" \u00d7 6'-2.5\" \u00b7 170.5 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-118-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-118-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Mud Hall & Lockers \u2014 North Wall (27'-5.5\")",
          "clearWidthIn": 329.5,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-118-N-1",
              "kind": "base_doors",
              "label": "Mud Lockers + Wood Bench + Hooks ('10'-1 1/2\"')",
              "widthIn": 90,
              "heightIn": 108,
              "depthIn": 20,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=90\" \u00b7 H=108\" \u00b7 D=20\""
            },
            {
              "id": "bay-118-N-2",
              "kind": "tall_tower",
              "label": "Tall Broom / Utility Cabinet",
              "widthIn": 30,
              "heightIn": 108,
              "depthIn": 20,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=30\" \u00b7 H=108\" \u00b7 D=20\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Mud Hall & Lockers \u2014 East Wall (6'-2.5\")",
          "clearWidthIn": 74.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Mud Hall & Lockers \u2014 South Wall (27'-5.5\")",
          "clearWidthIn": 329.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Mud Hall & Lockers \u2014 West Wall (6'-2.5\")",
          "clearWidthIn": 74.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-5971346-118",
          "wall": "S",
          "offsetIn": 198.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6012690-118",
          "wall": "S",
          "offsetIn": 106.1,
          "widthIn": 38,
          "kind": "door",
          "swing": "in-left"
        }
      ]
    },
    {
      "id": "120",
      "number": "120",
      "name": "Hall Closet",
      "subtitle": "10'-0\" Clg \u00b7 Accent Wood Floor Piece",
      "status": "draft",
      "planRect": {
        "xIn": 282.6,
        "yIn": 323.4,
        "widthIn": 54.4,
        "depthIn": 41.6
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (4'-6.5\" \u00d7 3'-5.5\" \u00b7 15.7 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-120-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-120-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Hall Closet \u2014 North Wall (4'-6.5\")",
          "clearWidthIn": 54.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Hall Closet \u2014 East Wall (3'-5.5\")",
          "clearWidthIn": 41.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Hall Closet \u2014 South Wall (4'-6.5\")",
          "clearWidthIn": 54.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Hall Closet \u2014 West Wall (3'-5.5\")",
          "clearWidthIn": 41.6,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-120-W-1",
              "kind": "closet_shelves",
              "label": "Linen / Coat Shelving",
              "widthIn": 42,
              "heightIn": 96,
              "depthIn": 18,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=42\" \u00b7 H=96\" \u00b7 D=18\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        }
      ],
      "planOpenings": [
        {
          "id": "op-5996901-120",
          "wall": "S",
          "offsetIn": 2.0,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ]
    }
  ]
} as HouseMatrix

export const SYNATSCHK_SANDBOX_L2_MATRIX: HouseMatrix = {
  "projectId": "sandbox-two-story-l2",
  "projectName": "Synatschk Sandbox \u2014 Level 2 (893 sf \u00b7 8 Rooms + Loft)",
  "stageLabel": "Sandbox D2 Matrix \u00b7 Level 2.0 (7 Flex Partitions \u00b7 Open Void & Balcony)",
  "flexWalls": {
    "fw-l2-5981062": {
      "id": "fw-l2-5981062",
      "label": "Bed 3 \u2194 Loft (33'-8\")",
      "roomAId": "202",
      "roomBId": "201",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-5981124": {
      "id": "fw-l2-5981124",
      "label": "Bath 3 \u2194 Bed 3 (16'-2\")",
      "roomAId": "203",
      "roomBId": "202",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-5981229": {
      "id": "fw-l2-5981229",
      "label": "Bed 4 \u2194 Bath 3 (16'-2\")",
      "roomAId": "205",
      "roomBId": "203",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-5981523": {
      "id": "fw-l2-5981523",
      "label": "Bath 3 \u2194 WIC 3 (Bed 3) (6'-0\")",
      "roomAId": "203",
      "roomBId": "204",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-6001155": {
      "id": "fw-l2-6001155",
      "label": "Bath 4 \u2194 WIC 4 (Bed 4) (12'-1.5\")",
      "roomAId": "206",
      "roomBId": "207",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-6003475": {
      "id": "fw-l2-6003475",
      "label": "WIC 4 (Bed 4) \u2194 Loft Closet (7'-10\")",
      "roomAId": "207",
      "roomBId": "209",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-6019535": {
      "id": "fw-l2-6019535",
      "label": "Bath 3 \u2194 Bed 3 (2'-10.5\")",
      "roomAId": "203",
      "roomBId": "202",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    },
    "fw-l2-6019636": {
      "id": "fw-l2-6019636",
      "label": "Bed 4 \u2194 Bath 3 (2'-10.5\")",
      "roomAId": "205",
      "roomBId": "203",
      "nudgeIn": 0,
      "maxNudgeIn": 6,
      "studThicknessIn": 4.5
    }
  },
  "rooms": [
    {
      "id": "201",
      "number": "201",
      "name": "Loft",
      "subtitle": "10'-0\" Clg \u00b7 Wood Grain Tile \u00b7 Overlooks Great Room + Full-Glass Balcony Door",
      "status": "draft",
      "planRect": {
        "xIn": 196.1,
        "yIn": 66.0,
        "widthIn": 145.4,
        "depthIn": 293.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (12'-1.5\" \u00d7 24'-5\" \u00b7 296.0 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-201-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-201-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Loft \u2014 North Wall (12'-1.5\")",
          "clearWidthIn": 145.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Loft \u2014 East Wall (24'-5\")",
          "clearWidthIn": 293.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Loft \u2014 South Wall (12'-1.5\")",
          "clearWidthIn": 145.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Loft \u2014 West Wall (24'-5\")",
          "clearWidthIn": 293.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l2-5981062",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-6004195-201",
          "wall": "S",
          "offsetIn": 5.8,
          "widthIn": 34,
          "kind": "door",
          "swing": "in-left"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l2-5981062",
        "role": "shift_west"
      }
    },
    {
      "id": "202",
      "number": "202",
      "name": "Bed 3",
      "subtitle": "10'-0\" Clg \u00b7 Built-In Bunk Wall + Casement Windows",
      "status": "draft",
      "planRect": {
        "xIn": 4.0,
        "yIn": 66.0,
        "widthIn": 187.7,
        "depthIn": 175.0
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (15'-7.5\" \u00d7 14'-7\" \u00b7 228.0 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-202-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-202-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Bed 3 \u2014 North Wall (15'-7.5\")",
          "clearWidthIn": 187.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Bed 3 \u2014 East Wall (14'-7\")",
          "clearWidthIn": 175.0,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-202-E-1",
              "kind": "tall_tower",
              "label": "Built-In Custom Bunk System",
              "widthIn": 84,
              "heightIn": 108,
              "depthIn": 42,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=84\" \u00b7 H=108\" \u00b7 D=42\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true,
          "flexBinding": {
            "flexWallId": "fw-l2-5981062",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Bed 3 \u2014 South Wall (15'-7.5\")",
          "clearWidthIn": 187.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Bed 3 \u2014 West Wall (14'-7\")",
          "clearWidthIn": 175.0,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-5999953-202",
          "wall": "E",
          "offsetIn": 130.2,
          "widthIn": 42,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-5999980-202",
          "wall": "S",
          "offsetIn": 38.3,
          "widthIn": 81,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6000736-202",
          "wall": "N",
          "offsetIn": 78.1,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-6000837-202",
          "wall": "N",
          "offsetIn": 30.1,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-6007957-202",
          "wall": "W",
          "offsetIn": 7.0,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-6007958-202",
          "wall": "W",
          "offsetIn": 121.0,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l2-5981062",
        "role": "expand_east"
      }
    },
    {
      "id": "203",
      "number": "203",
      "name": "Bath 3",
      "subtitle": "10'-0\" Clg \u00b7 'Like Master' Vanity + Curtain Tub/Shower",
      "status": "draft",
      "planRect": {
        "xIn": 4.0,
        "yIn": 245.5,
        "widthIn": 131.6,
        "depthIn": 67.7
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (10'-11.5\" \u00d7 5'-7.5\" \u00b7 61.9 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-203-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-203-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Bath 3 \u2014 North Wall (10'-11.5\")",
          "clearWidthIn": 131.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Bath 3 \u2014 East Wall (5'-7.5\")",
          "clearWidthIn": 67.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l2-5981523",
            "polarity": 1
          }
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Bath 3 \u2014 South Wall (10'-11.5\")",
          "clearWidthIn": 131.6,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-203-S-1",
              "kind": "sink_base",
              "label": "Vanity ('Like Master')",
              "widthIn": 48,
              "heightIn": 36,
              "depthIn": 22,
              "affIn": 0,
              "hasMirror": true,
              "hasSconces": true,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=36\" \u00b7 D=22\""
            },
            {
              "id": "bay-203-S-2",
              "kind": "toilet_bay",
              "label": "WC Bay",
              "widthIn": 32,
              "heightIn": 36,
              "depthIn": 28,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=32\" \u00b7 H=36\" \u00b7 D=28\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Bath 3 \u2014 West Wall (5'-7.5\")",
          "clearWidthIn": 67.7,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-203-W-3",
              "kind": "wet_room_glass",
              "label": "Tub/Shower w/ Curtain",
              "widthIn": 60,
              "heightIn": 96,
              "depthIn": 32,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=60\" \u00b7 H=96\" \u00b7 D=32\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        }
      ],
      "planOpenings": [
        {
          "id": "op-5999980-203",
          "wall": "N",
          "offsetIn": 38.3,
          "widthIn": 81,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6000023-203",
          "wall": "E",
          "offsetIn": 6.1,
          "widthIn": 59,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6031499-203",
          "wall": "W",
          "offsetIn": 9.5,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l2-5981523",
        "role": "expand_east"
      }
    },
    {
      "id": "204",
      "number": "204",
      "name": "WIC 3 (Bed 3)",
      "subtitle": "10'-0\" Clg \u00b7 Shelving + Bench for Suitcase Drawers",
      "status": "draft",
      "planRect": {
        "xIn": 140.2,
        "yIn": 245.5,
        "widthIn": 51.5,
        "depthIn": 67.7
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (4'-3.5\" \u00d7 5'-7.5\" \u00b7 24.2 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-204-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-204-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "WIC 3 (Bed 3) \u2014 North Wall (4'-3.5\")",
          "clearWidthIn": 51.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "WIC 3 (Bed 3) \u2014 East Wall (5'-7.5\")",
          "clearWidthIn": 67.7,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-204-E-1",
              "kind": "closet_drawers",
              "label": "Suitcase Drawer Bench + Shelving",
              "widthIn": 60,
              "heightIn": 96,
              "depthIn": 20,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=60\" \u00b7 H=96\" \u00b7 D=20\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "WIC 3 (Bed 3) \u2014 South Wall (4'-3.5\")",
          "clearWidthIn": 51.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "WIC 3 (Bed 3) \u2014 West Wall (5'-7.5\")",
          "clearWidthIn": 67.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false,
          "flexBinding": {
            "flexWallId": "fw-l2-5981523",
            "polarity": -1
          }
        }
      ],
      "planOpenings": [
        {
          "id": "op-6000023-204",
          "wall": "W",
          "offsetIn": 6.1,
          "widthIn": 59,
          "kind": "door",
          "swing": "in-left"
        }
      ],
      "flexPlanBinding": {
        "flexWallId": "fw-l2-5981523",
        "role": "shift_west"
      }
    },
    {
      "id": "205",
      "number": "205",
      "name": "Bed 4",
      "subtitle": "10'-0\" Clg \u00b7 Casement Windows + Hidden Mirror Door to WIC",
      "status": "draft",
      "planRect": {
        "xIn": 4.0,
        "yIn": 317.8,
        "widthIn": 187.7,
        "depthIn": 144.2
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (15'-7.5\" \u00d7 12'-0\" \u00b7 188.0 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-205-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-205-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Bed 4 \u2014 North Wall (15'-7.5\")",
          "clearWidthIn": 187.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Bed 4 \u2014 East Wall (12'-0\")",
          "clearWidthIn": 144.2,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-205-E-1",
              "kind": "door",
              "label": "Hidden Mirror Door into WIC 4",
              "widthIn": 32,
              "heightIn": 84,
              "depthIn": 4,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=32\" \u00b7 H=84\" \u00b7 D=4\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Bed 4 \u2014 South Wall (15'-7.5\")",
          "clearWidthIn": 187.7,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Bed 4 \u2014 West Wall (12'-0\")",
          "clearWidthIn": 144.2,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-6001216-205",
          "wall": "E",
          "offsetIn": 2.0,
          "widthIn": 42,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6002001-205",
          "wall": "E",
          "offsetIn": 42.7,
          "widthIn": 81,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6004561-205",
          "wall": "W",
          "offsetIn": 24.2,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        },
        {
          "id": "op-6004607-205",
          "wall": "W",
          "offsetIn": 72.2,
          "widthIn": 48,
          "kind": "window",
          "swing": "none"
        }
      ]
    },
    {
      "id": "206",
      "number": "206",
      "name": "Bath 4",
      "subtitle": "10'-0\" Clg \u00b7 'Like Master' Vanity + Sliding Glass Shower",
      "status": "draft",
      "planRect": {
        "xIn": 196.1,
        "yIn": 393.7,
        "widthIn": 140.9,
        "depthIn": 68.3
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (11'-9\" \u00d7 5'-8.5\" \u00b7 66.8 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-206-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-206-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Bath 4 \u2014 North Wall (11'-9\")",
          "clearWidthIn": 140.9,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Bath 4 \u2014 East Wall (5'-8.5\")",
          "clearWidthIn": 68.3,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-206-E-3",
              "kind": "wet_room_glass",
              "label": "Sliding Glass Shower",
              "widthIn": 48,
              "heightIn": 96,
              "depthIn": 36,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=96\" \u00b7 D=36\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Bath 4 \u2014 South Wall (11'-9\")",
          "clearWidthIn": 140.9,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-206-S-1",
              "kind": "sink_base",
              "label": "Vanity ('Like Master')",
              "widthIn": 48,
              "heightIn": 36,
              "depthIn": 22,
              "affIn": 0,
              "hasMirror": true,
              "hasSconces": true,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=48\" \u00b7 H=36\" \u00b7 D=22\""
            },
            {
              "id": "bay-206-S-2",
              "kind": "toilet_bay",
              "label": "WC Bay",
              "widthIn": 32,
              "heightIn": 36,
              "depthIn": 28,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=32\" \u00b7 H=36\" \u00b7 D=28\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Bath 4 \u2014 West Wall (5'-8.5\")",
          "clearWidthIn": 68.3,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-6002001-206",
          "wall": "W",
          "offsetIn": 2.0,
          "widthIn": 81,
          "kind": "door",
          "swing": "in-left"
        },
        {
          "id": "op-6002667-206",
          "wall": "N",
          "offsetIn": 15.5,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ]
    },
    {
      "id": "207",
      "number": "207",
      "name": "WIC 4 (Bed 4)",
      "subtitle": "10'-0\" Clg \u00b7 Hidden Mirror Entry + Suitcase Drawer Bench",
      "status": "draft",
      "planRect": {
        "xIn": 247.6,
        "yIn": 341.6,
        "widthIn": 89.4,
        "depthIn": 47.6
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (7'-5.5\" \u00d7 3'-11.5\" \u00b7 29.6 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-207-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-207-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "WIC 4 (Bed 4) \u2014 North Wall (7'-5.5\")",
          "clearWidthIn": 89.4,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-207-N-1",
              "kind": "closet_drawers",
              "label": "Bench for Suitcase Drawers + Hanging/Shelves",
              "widthIn": 84,
              "heightIn": 96,
              "depthIn": 20,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=84\" \u00b7 H=96\" \u00b7 D=20\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "WIC 4 (Bed 4) \u2014 East Wall (3'-11.5\")",
          "clearWidthIn": 47.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "WIC 4 (Bed 4) \u2014 South Wall (7'-5.5\")",
          "clearWidthIn": 89.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "WIC 4 (Bed 4) \u2014 West Wall (3'-11.5\")",
          "clearWidthIn": 47.6,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-6002667-207",
          "wall": "W",
          "offsetIn": 4.1,
          "widthIn": 75,
          "kind": "door",
          "swing": "in-left"
        }
      ]
    },
    {
      "id": "209",
      "number": "209",
      "name": "Loft Closet",
      "subtitle": "10'-0\" Clg \u00b7 Double-Swing Doors + Shelving",
      "status": "draft",
      "planRect": {
        "xIn": 247.6,
        "yIn": 301.7,
        "widthIn": 89.4,
        "depthIn": 35.5
      },
      "ceilingHeightIn": 120,
      "ceilingLabel": "10'-0\" Ceiling (7'-5.5\" \u00d7 2'-11.5\" \u00b7 22.1 sf)",
      "wallThicknessIn": 4.5,
      "datums": [
        {
          "id": "d-209-36",
          "affIn": 36,
          "label": "36\" COUNTER"
        },
        {
          "id": "d-209-108",
          "affIn": 108,
          "label": "9'-0\" ALIGN"
        }
      ],
      "walls": [
        {
          "id": "N",
          "shortLabel": "N",
          "title": "Loft Closet \u2014 North Wall (7'-5.5\")",
          "clearWidthIn": 89.4,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "E",
          "shortLabel": "E",
          "title": "Loft Closet \u2014 East Wall (2'-11.5\")",
          "clearWidthIn": 35.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        },
        {
          "id": "S",
          "shortLabel": "S",
          "title": "Loft Closet \u2014 South Wall (7'-5.5\")",
          "clearWidthIn": 89.4,
          "ceilingHeightIn": 120,
          "bays": [
            {
              "id": "bay-209-S-1",
              "kind": "closet_shelves",
              "label": "Double-Swing Storage Shelving",
              "widthIn": 84,
              "heightIn": 96,
              "depthIn": 20,
              "affIn": 0,
              "hasMirror": false,
              "hasSconces": false,
              "revitFamily": "Barnhaus_Parametric_Catalog.rfa",
              "revitParams": "W=84\" \u00b7 H=96\" \u00b7 D=20\""
            }
          ],
          "autoCenter": true,
          "isCaseworkWall": true
        },
        {
          "id": "W",
          "shortLabel": "W",
          "title": "Loft Closet \u2014 West Wall (2'-11.5\")",
          "clearWidthIn": 35.5,
          "ceilingHeightIn": 120,
          "bays": [],
          "autoCenter": true,
          "isCaseworkWall": false
        }
      ],
      "planOpenings": [
        {
          "id": "op-6017195-209",
          "wall": "N",
          "offsetIn": 11.1,
          "widthIn": 65,
          "kind": "door",
          "swing": "in-left"
        }
      ]
    }
  ]
} as HouseMatrix
