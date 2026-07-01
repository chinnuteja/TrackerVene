export const ROOM_POS: Record<string, { x: number; y: number }> = {
  Bedroom:    { x: 90,  y: 90 },
  Bathroom:   { x: 90,  y: 200 },
  Kitchen:    { x: 220, y: 90 },
  DiningRoom: { x: 320, y: 120 },
  LivingRoom: { x: 250, y: 230 },
  Office:     { x: 320, y: 300 },
  Entry:      { x: 150, y: 320 },
  FrontDoor:  { x: 150, y: 380 },
};
export const EDGES: [string, string][] = [
  ["Bedroom","Bathroom"], ["Bedroom","Kitchen"], ["Kitchen","DiningRoom"],
  ["Kitchen","LivingRoom"], ["LivingRoom","Office"], ["LivingRoom","Entry"],
  ["Entry","FrontDoor"], ["DiningRoom","LivingRoom"],
];

// The resident's OWN home (from the iPhone walk) — used by the iphone_realday scenario.
export const IPHONE_POS: Record<string, { x: number; y: number }> = {
  "Main Bedroom":   { x: 100, y: 90 },
  "Second Bedroom": { x: 300, y: 90 },
  "Hall":           { x: 200, y: 200 },
  "Bathroom":       { x: 100, y: 310 },
  "Kitchen":        { x: 300, y: 310 },
};
export const IPHONE_EDGES: [string, string][] = [
  ["Main Bedroom","Hall"], ["Hall","Second Bedroom"], ["Main Bedroom","Second Bedroom"],
  ["Main Bedroom","Bathroom"], ["Second Bedroom","Kitchen"], ["Bathroom","Second Bedroom"],
];
