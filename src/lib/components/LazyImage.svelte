<script>
  let { src, alt = '', ratio = '1/1', title = '', tags = [], onclick } = $props();
  let loaded = $state(false);
  let errorState = $state(false);
  let isHovered = $state(false);

  const isVideoSource = $derived(
    src && (
      src.startsWith('data:video/') || 
      /\.(mp4|webm|ogg|mov)$/i.test(src.split('?')[0].split('#')[0]) ||
      /=(m\d+|dv)$/i.test(src)
    )
  );

  // Sort tags: Years first, followed by people alphabetically, then others
  const sortedTags = $derived.by(() => {
    if (!tags || !Array.isArray(tags)) return [];
    return [...tags].sort((a, b) => {
      const isYearA = /^[0-9]{4}$/.test(a);
      const isYearB = /^[0-9]{4}$/.test(b);
      if (isYearA && !isYearB) return -1;
      if (!isYearA && isYearB) return 1;
      return a.localeCompare(b);
    });
  });

  // Deterministic organic scrapbook styling (chaos but controlled and beautiful)
  const organicStyle = $derived.by(() => {
    let hash = 0;
    const str = src || title || '';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Rotation between -2.5deg and +2.5deg
    const rotVal = ((Math.abs(hash) % 50) - 25) / 10; 
    
    // Top Margin Shift between -8px and 28px
    const marginVal = ((Math.abs(hash >> 2) % 36) - 8); 
    
    return {
      rotation: `rotate(${rotVal}deg)`,
      marginTop: `${marginVal}px`
    };
  });
</script>

<button
  type="button"
  class="relative overflow-hidden w-full bg-slate-900/40 rounded-2xl group border border-white/5 shadow-lg shadow-black/10 hover:shadow-2xl transition-all duration-500 text-left outline-none cursor-pointer select-none break-inside-avoid mb-6 block"
  style="aspect-ratio: {ratio}; margin-top: {organicStyle.marginTop}; transform: {isHovered ? 'rotate(0deg) translateY(-6px)' : organicStyle.rotation}; z-index: {isHovered ? '30' : 'auto'};"
  {onclick}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  <!-- Loading Shimmer -->
  {#if !loaded && !errorState}
    <div class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-3 overflow-hidden">
      <!-- Pulsing gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
      <!-- Spinner -->
      <div class="w-8 h-8 rounded-full border-2 border-violet-500/10 border-t-violet-500 animate-spin"></div>
    </div>
  {/if}

  <!-- Error State fallback -->
  {#if errorState}
    <div class="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center p-4 text-center">
      <svg class="w-8 h-8 text-rose-500/60 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span class="text-xs text-slate-400 font-medium">Failed to load image</span>
    </div>
  {/if}

  <!-- Media element (Video or Image) -->
  {#if isVideoSource}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      src={src}
      referrerpolicy="no-referrer"
      class="w-full h-full object-cover transition-all duration-700 ease-out"
      class:opacity-0={!loaded}
      class:opacity-100={loaded}
      autoplay
      muted
      loop
      playsinline
      onloadeddata={() => loaded = true}
      onerror={() => errorState = true}
    ></video>
  {:else}
    <img
      src={src}
      alt={alt || title}
      referrerpolicy="no-referrer"
      loading="lazy"
      class="w-full h-full object-cover transition-all duration-700 ease-out"
      class:opacity-0={!loaded}
      class:opacity-100={loaded}
      onload={() => loaded = true}
      onerror={() => errorState = true}
    />
  {/if}

  <!-- Pinterest-style Glass Overlay (revealed on hover) -->
  <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-900/10 opacity-0 group-hover:opacity-100 transition-all duration-300 p-5 flex flex-col justify-end">
    <!-- Sliding text content -->
    <div class="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-out">
      
      <!-- Tags list inside card -->
      <div class="flex flex-wrap gap-1.5 pointer-events-auto">
        {#each sortedTags.slice(0, 3) as tag (tag)}
          <span class="px-2 py-0.5 text-[10px] font-semibold bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full border border-white/10 transition-colors uppercase tracking-wider">
            #{tag}
          </span>
        {/each}
        {#if sortedTags.length > 3}
          <span class="px-2 py-0.5 text-[10px] font-semibold bg-white/5 backdrop-blur-md text-white/70 rounded-full border border-white/5">
            +{sortedTags.length - 3}
          </span>
        {/if}
      </div>
    </div>
  </div>
</button>

<style>
  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }
</style>
