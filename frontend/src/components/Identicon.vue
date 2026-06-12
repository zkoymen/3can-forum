<script setup>
import { computed } from "vue";
import { useProfilePic } from "../composables/useProfilePic";

const props = defineProps({
  address: { type: String, required: true },
  size: { type: Number, default: 18 },
  className: { type: String, default: "" },
});

const profilePic = useProfilePic();
const picUrl = computed(() => profilePic.getUrl(props.address));

function hashAddr(addr) {
  let h = 5381;
  const s = addr || "0x0";
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const grid = computed(() => {
  let r = hashAddr(props.address || "0x0");
  const g = [];
  for (let y = 0; y < 5; y++) {
    const row = [];
    for (let x = 0; x < 3; x++) {
      r = (r * 1664525 + 1013904223) >>> 0;
      row.push((r & 1) === 1);
    }
    g.push([row[0], row[1], row[2], row[1], row[0]]);
  }
  return g;
});

const colors = computed(() => {
  const hue = hashAddr(props.address || "0x0") % 360;
  return {
    fg: `hsl(${hue} 65% 42%)`,
    bg: `hsl(${(hue + 200) % 360} 60% 90%)`,
  };
});
</script>

<template>
  <img
    v-if="picUrl"
    :src="picUrl"
    :width="size"
    :height="size"
    class="avatar"
    :class="className"
    alt=""
    loading="lazy"
  />
  <svg
    v-else
    :width="size"
    :height="size"
    viewBox="0 0 5 5"
    class="identicon-svg"
    :class="className"
    :style="{ background: colors.bg, display: 'block' }"
  >
    <template v-for="(row, y) in grid" :key="y">
      <rect
        v-for="(on, x) in row"
        :key="`${x}-${y}`"
        v-show="on"
        :x="x"
        :y="y"
        width="1"
        height="1"
        :fill="colors.fg"
      />
    </template>
  </svg>
</template>

<style scoped>
.avatar {
  object-fit: cover;
  display: block;
}
</style>
