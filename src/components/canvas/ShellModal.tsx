'use client'

import React, { useState } from 'react'
import {
  formatArchInches,
  snapHalfInch,
  type RoomNode,
  type RoomTemplateKind,
} from '@/lib/canvas-matrix'

export type StudioModalMode = 'new_house' | 'add_room' | 'edit_shell' | null

interface ShellModalProps {
  mode: StudioModalMode
  activeRoom: RoomNode
  nextRoomNumber: string
  onClose: () => void
  onCreateHouse: (name: string, baseTemplateId: string) => void
  onAddRoom: (input: {
    number: string
    name: string
    template: RoomTemplateKind
    widthIn: number
    depthIn: number
    ceilingHeightIn: number
  }) => void
  onUpdateShell: (
    roomId: string,
    updates: {
      name: string
      number: string
      widthIn: number
      depthIn: number
      ceilingHeightIn: number
    }
  ) => void
}

export function ShellModal({
  mode,
  activeRoom,
  nextRoomNumber,
  onClose,
  onCreateHouse,
  onAddRoom,
  onUpdateShell,
}: ShellModalProps) {
  const [tab, setTab] = useState<'add' | 'edit'>(mode === 'edit_shell' ? 'edit' : 'add')

  // New House fields
  const [houseName, setHouseName] = useState('')
  const [housePreset, setHousePreset] = useState('blank-custom-shell')

  // Add Room fields
  const [roomNum, setRoomNum] = useState(nextRoomNumber)
  const [roomName, setRoomName] = useState('Primary Bath')
  const [roomTemplate, setRoomTemplate] = useState<RoomTemplateKind>('bathroom_vanity')
  const [addWidthIn, setAddWidthIn] = useState(144)
  const [addDepthIn, setAddDepthIn] = useState(120)
  const [addCeilIn, setAddCeilIn] = useState(120)

  // Edit Active Shell fields
  const [editNum, setEditNum] = useState(activeRoom.number)
  const [editName, setEditName] = useState(activeRoom.name)
  const [editWidthIn, setEditWidthIn] = useState(activeRoom.planRect.widthIn)
  const [editDepthIn, setEditDepthIn] = useState(activeRoom.planRect.depthIn)
  const [editCeilIn, setEditCeilIn] = useState(activeRoom.ceilingHeightIn)

  if (!mode) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-bh-border bg-bh-panel p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'new_house' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onCreateHouse(houseName.trim() || 'Custom Residence — Matrix', housePreset)
              onClose()
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Create New House Matrix</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Project / Residence Name</label>
              <input
                type="text"
                required
                autoFocus
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                placeholder="e.g. Fredericksburg Ranch — 3,600 sf"
                className="field"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Starting Shell Template</label>
              <select
                value={housePreset}
                onChange={(e) => setHousePreset(e.target.value)}
                className="field"
              >
                <option value="blank-custom-shell">
                  Blank Custom Shell (Starter Great Room + Kitchen)
                </option>
                <option value="barnhaus-modern-2800">
                  Barnhaus Modern — 2,800 sf (5 Rooms)
                </option>
                <option value="hill-country-4200">
                  Hill Country Vaulted — 4,200 sf (6 Rooms + Flex Wall)
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary-sm">
                Cancel
              </button>
              <button type="submit" className="btn-primary-sm">
                Create House →
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-lg border border-bh-border bg-bh-black p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTab('add')}
                  className={
                    'rounded-md px-3 py-1 font-medium ' +
                    (tab === 'add' ? 'bg-bh-card text-white' : 'text-slate-400 hover:text-white')
                  }
                >
                  + Add Room
                </button>
                <button
                  type="button"
                  onClick={() => setTab('edit')}
                  className={
                    'rounded-md px-3 py-1 font-medium ' +
                    (tab === 'edit' ? 'bg-bh-card text-white' : 'text-slate-400 hover:text-white')
                  }
                >
                  Edit Shell ({activeRoom.number})
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {tab === 'add' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  onAddRoom({
                    number: roomNum,
                    name: roomName,
                    template: roomTemplate,
                    widthIn: addWidthIn,
                    depthIn: addDepthIn,
                    ceilingHeightIn: addCeilIn,
                  })
                  onClose()
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Room #</label>
                    <input
                      type="text"
                      value={roomNum}
                      onChange={(e) => setRoomNum(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Room Name</label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Room Architectural Template
                  </label>
                  <select
                    value={roomTemplate}
                    onChange={(e) => {
                      const t = e.target.value as RoomTemplateKind
                      setRoomTemplate(t)
                      if (t === 'kitchen_island') {
                        setRoomName('Kitchen')
                        setAddWidthIn(180)
                        setAddDepthIn(192)
                        setAddCeilIn(144)
                      } else if (t === 'living_fireplace') {
                        setRoomName('Great Room')
                        setAddWidthIn(228)
                        setAddDepthIn(192)
                        setAddCeilIn(144)
                      } else if (t === 'walk_in_closet') {
                        setRoomName('Walk-In Closet')
                        setAddWidthIn(156)
                        setAddDepthIn(108)
                        setAddCeilIn(120)
                      } else if (t === 'bathroom_vanity') {
                        setRoomName('Bath')
                        setAddWidthIn(144)
                        setAddDepthIn(108)
                        setAddCeilIn(120)
                      }
                    }}
                    className="field"
                  >
                    <option value="bathroom_vanity">Bath — Symmetric Vanity & Wet Zone</option>
                    <option value="kitchen_island">Kitchen — Cooking Wall, Towers & Island</option>
                    <option value="living_fireplace">Living — Stone Fireplace & Built-Ins</option>
                    <option value="walk_in_closet">Closet — Shared 32&quot;/84&quot;/96&quot; Datums</option>
                    <option value="bedroom_suite">Bedroom / Study Suite</option>
                    <option value="empty_shell">Empty Architectural Shell</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Width ({formatArchInches(addWidthIn)})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="48"
                      max="480"
                      value={addWidthIn}
                      onChange={(e) => setAddWidthIn(snapHalfInch(parseFloat(e.target.value) || 120))}
                      className="field font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Depth ({formatArchInches(addDepthIn)})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="48"
                      max="480"
                      value={addDepthIn}
                      onChange={(e) => setAddDepthIn(snapHalfInch(parseFloat(e.target.value) || 120))}
                      className="field font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Ceiling ({formatArchInches(addCeilIn)})
                    </label>
                    <input
                      type="number"
                      step="6"
                      min="96"
                      max="260"
                      value={addCeilIn}
                      onChange={(e) => setAddCeilIn(snapHalfInch(parseFloat(e.target.value) || 120))}
                      className="field font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={onClose} className="btn-secondary-sm">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-sm">
                    + Add Room to Matrix
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  onUpdateShell(activeRoom.id, {
                    number: editNum,
                    name: editName,
                    widthIn: editWidthIn,
                    depthIn: editDepthIn,
                    ceilingHeightIn: editCeilIn,
                  })
                  onClose()
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Room #</label>
                    <input
                      type="text"
                      value={editNum}
                      onChange={(e) => setEditNum(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Room Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Clear W ({formatArchInches(editWidthIn)})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="48"
                      max="480"
                      value={editWidthIn}
                      onChange={(e) => setEditWidthIn(snapHalfInch(parseFloat(e.target.value) || 120))}
                      className="field font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Depth ({formatArchInches(editDepthIn)})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="48"
                      max="480"
                      value={editDepthIn}
                      onChange={(e) => setEditDepthIn(snapHalfInch(parseFloat(e.target.value) || 120))}
                      className="field font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Ceiling ({formatArchInches(editCeilIn)})
                    </label>
                    <input
                      type="number"
                      step="6"
                      min="96"
                      max="260"
                      value={editCeilIn}
                      onChange={(e) => setEditCeilIn(snapHalfInch(parseFloat(e.target.value) || 120))}
                      className="field font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={onClose} className="btn-secondary-sm">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-sm">
                    Save Room Shell
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
