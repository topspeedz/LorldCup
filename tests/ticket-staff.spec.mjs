import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const config = name => JSON.parse(read(`web/config/${name}.json`));
const glb = path => {
  const buffer = readFileSync(new URL(`../${path}`, import.meta.url));
  return JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
};

test('ticket staff config places three staff behind the barrier and outside the central path without a GPU', () => {
  const { staff, uniformColor } = config('ticket-staff');
  const { barrier } = config('ticket'), { ids } = config('characters');
  expect(staff).toHaveLength(3);
  expect(uniformColor).toBe('#7fdcff');
  const middle = (barrier.z[0] + barrier.z[1]) / 2;
  for (const member of staff) {
    expect(ids).toContain(member.character);
    expect(member.position).toHaveLength(3);
    expect(member.position.every(Number.isFinite)).toBe(true);
    const [x, y, z] = member.position;
    expect(x).toBeGreaterThan(barrier.x);
    expect(x - barrier.x).toBeLessThanOrEqual(3);
    expect(Math.abs(y - barrier.y[0])).toBeLessThanOrEqual(.1);
    expect(z).toBeGreaterThan(barrier.z[0] + .5);
    expect(z).toBeLessThan(barrier.z[1] - .5);
    expect(Math.abs(z - middle)).toBeGreaterThan(2);
    expect(Number.isFinite(member.yaw)).toBe(true);
    expect(Math.sin(member.yaw)).toBeLessThan(-.9);
  }
  expect(staff.some(member => member.position[2] < middle)).toBe(true);
  expect(staff.some(member => member.position[2] > middle)).toBe(true);
  for (let i = 0; i < staff.length; i++) for (let j = i + 1; j < staff.length; j++) {
    expect(Math.hypot(staff[i].position[0] - staff[j].position[0], staff[i].position[2] - staff[j].position[2])).toBeGreaterThan(1.2);
  }
});

test('existing fan assets supply staff bodies, Uniform and Idle, and the arena supplies the gates', () => {
  const fan = glb('web/assets/characters/fan.glb');
  for (const { character } of config('ticket-staff').staff) expect(fan.nodes.some(node => node.name === character)).toBe(true);
  expect(fan.nodes.some(node => node.name === 'FanRig')).toBe(true);
  expect(fan.materials.some(material => material.name === 'Uniform')).toBe(true);
  const animation = glb(`web/${config('characters').clipFile.replace(/^\.\//, '')}`);
  expect(animation.animations.some(clip => clip.name === 'Idle')).toBe(true);
  const arena = glb('web/arena-v2.glb');
  for (const name of ['Collide_TicketGate__silver', 'Gate_reader__cyan']) expect(arena.nodes.some(node => node.name === name)).toBe(true);
});

test('ticket staff participates in module and config loading', () => {
  expect(read('web/modules.js')).toContain("{path:'ticket-staff.js',create:ticketStaff}");
  const names = read('web/main.js').match(/const configNames=\[([^\]]+)\]/)[1];
  expect(names.match(/'ticket-staff'/g)).toHaveLength(1);
});
