<script setup>
import { computed } from "vue";

const props = defineProps({
  text: { type: String, default: "" },
  preview: { type: Boolean, default: false },
});
const emit = defineEmits(["quoteClick"]);

const lines = computed(() => {
  const t = props.text || "";
  return t.split(/\n/).map((line, i) => {
    const m = line.match(/^>>(\d+)\s*(.*)$/);
    if (m) {
      return { type: "qref", id: i, postId: m[1], rest: m[2] };
    }
    if (line.startsWith(">")) {
      return { type: "gt", id: i, text: line };
    }
    return { type: "plain", id: i, text: line || " " };
  });
});

function onQuoteClick(e, postId) {
  e.stopPropagation();
  e.preventDefault();
  emit("quoteClick", parseInt(postId, 10));
}
</script>

<template>
  <template v-for="line in lines" :key="line.id">
    <div v-if="line.type === 'qref'">
      <span class="qref" @click="onQuoteClick($event, line.postId)">
        &gt;&gt;{{ line.postId }}
      </span>
      <span v-if="line.rest">{{ " " + line.rest }}</span>
    </div>
    <span v-else-if="line.type === 'gt'" class="gt">{{ line.text }}</span>
    <div v-else>{{ line.text }}</div>
  </template>
</template>
