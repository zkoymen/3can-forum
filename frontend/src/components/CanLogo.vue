<script setup>
defineProps({ size: { type: Number, default: 28 } });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 28 28" style="display: block">
    <defs>
      <linearGradient id="lcan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#E7F6FC" />
        <stop offset=".45" stop-color="#79BFD9" />
        <stop offset=".5" stop-color="#1684B0" />
        <stop offset="1" stop-color="#4DAACB" />
      </linearGradient>
      <linearGradient id="lcanHi" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity=".85" />
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
      </linearGradient>
    </defs>
    <ellipse cx="14" cy="25" rx="11" ry="1.4" fill="#0E2A47" opacity=".22" />
    <g v-for="(c, i) in [
      { x: 3, y: 8, w: 7, h: 16 },
      { x: 11, y: 4, w: 7, h: 20 },
      { x: 19, y: 7, w: 7, h: 17 },
    ]" :key="i">
      <ellipse :cx="c.x + c.w / 2" :cy="c.y" :rx="c.w / 2" ry="1.4" fill="#CBE4EF" stroke="#0F5C82" stroke-width=".5" />
      <rect :x="c.x" :y="c.y" :width="c.w" :height="c.h" fill="url(#lcan)" stroke="#0F5C82" stroke-width=".5" />
      <rect :x="c.x + 1" :y="c.y + 1" width="1.6" :height="c.h - 2" fill="url(#lcanHi)" />
    </g>
  </svg>
</template>
