<script setup>
import { computed } from "vue";

const props = defineProps({
  text: { type: String, default: "" },
  preview: { type: Boolean, default: false },
});
const emit = defineEmits(["quoteClick"]);

// Matches a post quote (>>123) OR an http(s) URL, anywhere in a line — so both
// work inline, not just at the start of a line.
const QUOTE_OR_URL = /(>>\d+)|(https?:\/\/[^\s<]+)/g;

function tokenizeLine(line) {
  const tokens = [];
  let last = 0;
  let m;
  QUOTE_OR_URL.lastIndex = 0;
  while ((m = QUOTE_OR_URL.exec(line)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: line.slice(last, m.index) });
    }
    if (m[1]) {
      tokens.push({ kind: "quote", value: m[1], postId: m[1].slice(2) });
    } else {
      // Trim trailing punctuation so "see https://x.com." doesn't swallow the
      // period (or a closing paren) into the link.
      let url = m[2];
      const tm = url.match(/[).,;:!?]+$/);
      const trailing = tm ? tm[0] : "";
      if (trailing) url = url.slice(0, -trailing.length);
      tokens.push({ kind: "url", value: url });
      if (trailing) tokens.push({ kind: "text", value: trailing });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) tokens.push({ kind: "text", value: line.slice(last) });
  if (tokens.length === 0) tokens.push({ kind: "text", value: " " });
  return tokens;
}

const lines = computed(() => {
  const t = props.text || "";
  return t.split(/\n/).map((line, i) => ({
    id: i,
    // A line starting with a single '>' (but not the '>>' of a quote) is greentext.
    greentext: line.startsWith(">") && !line.startsWith(">>"),
    tokens: tokenizeLine(line),
  }));
});

function onQuoteClick(e, postId) {
  e.stopPropagation();
  e.preventDefault();
  emit("quoteClick", parseInt(postId, 10));
}
</script>

<template>
  <div v-for="line in lines" :key="line.id" :class="{ gt: line.greentext }">
    <template v-for="(tok, j) in line.tokens" :key="j">
      <span
        v-if="tok.kind === 'quote' && !preview"
        class="qref"
        @click="onQuoteClick($event, tok.postId)"
        >{{ tok.value }}</span
      >
      <span v-else-if="tok.kind === 'quote'" class="qref" style="cursor: default">{{ tok.value }}</span>
      <a
        v-else-if="tok.kind === 'url' && !preview"
        class="linkified"
        :href="tok.value"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
        >{{ tok.value }}</a
      >
      <template v-else-if="tok.kind === 'url'">{{ tok.value }}</template>
      <template v-else>{{ tok.value }}</template>
    </template>
  </div>
</template>
