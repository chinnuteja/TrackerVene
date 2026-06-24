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
