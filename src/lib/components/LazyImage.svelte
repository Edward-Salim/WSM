<script>
	let { src, alt = '', ratio = '1/1', title = '', tags = [], onclick } = $props();
	let loaded = $state(false);
	let errorState = $state(false);
	let isHovered = $state(false);

	const isVideoSource = $derived(
		src &&
			(src.startsWith('data:video/') ||
				src.includes('/api/video?') ||
				/\.(mp4|webm|ogg|mov)$/i.test(src.split('?')[0].split('#')[0]) ||
				/=(m\d+|dv)$/i.test(src))
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
		const marginVal = (Math.abs(hash >> 2) % 36) - 8;

		return {
			rotation: `rotate(${rotVal}deg)`,
			marginTop: `${marginVal}px`
		};
	});
</script>

<button
	type="button"
	class="group relative mb-6 block w-full cursor-pointer break-inside-avoid overflow-hidden rounded-2xl border border-white/5 bg-slate-900/40 text-left shadow-lg shadow-black/10 transition-all duration-500 outline-none select-none hover:shadow-2xl"
	style="aspect-ratio: {ratio}; margin-top: {organicStyle.marginTop}; transform: {isHovered
		? 'rotate(0deg) translateY(-6px)'
		: organicStyle.rotation}; z-index: {isHovered ? '30' : 'auto'};"
	{onclick}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
>
	<!-- Loading Shimmer -->
	{#if !loaded && !errorState}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-slate-900"
		>
			<!-- Pulsing gradient overlay -->
			<div
				class="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-slate-900 via-slate-800/80 to-slate-900"
			></div>
			<!-- Spinner -->
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/10 border-t-violet-500"
			></div>
		</div>
	{/if}

	<!-- Error State fallback -->
	{#if errorState}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 p-4 text-center"
		>
			<svg
				class="mb-2 h-8 w-8 text-rose-500/60"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span class="text-xs font-medium text-slate-400">Failed to load media</span>
		</div>
	{/if}

	<!-- Media element (Video or Image) -->
	{#if isVideoSource}
		<video
			{src}
			preload="metadata"
			class="h-full w-full object-cover transition-all duration-700 ease-out"
			class:opacity-0={!loaded}
			class:opacity-100={loaded}
			autoplay
			muted
			loop
			playsinline
			onloadedmetadata={() => (loaded = true)}
			oncanplay={() => (loaded = true)}
			onerror={() => (errorState = true)}
		></video>
	{:else}
		<img
			{src}
			alt={alt || title}
			referrerpolicy="no-referrer"
			loading="lazy"
			class="h-full w-full object-cover transition-all duration-700 ease-out"
			class:opacity-0={!loaded}
			class:opacity-100={loaded}
			onload={() => (loaded = true)}
			onerror={() => (errorState = true)}
		/>
	{/if}

	<!-- Pinterest-style Glass Overlay (revealed on hover) -->
	<div
		class="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-slate-950 via-slate-950/40 to-slate-900/10 p-5 opacity-0 transition-all duration-300 group-hover:opacity-100"
	>
		<!-- Sliding text content -->
		<div
			class="translate-y-4 transform transition-transform duration-300 ease-out group-hover:translate-y-0"
		>
			<!-- Tags list inside card -->
			<div class="pointer-events-auto flex flex-wrap gap-1.5">
				{#each sortedTags.slice(0, 3) as tag (tag)}
					<span
						class="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase backdrop-blur-md transition-colors hover:bg-white/20"
					>
						#{tag}
					</span>
				{/each}
				{#if sortedTags.length > 3}
					<span
						class="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur-md"
					>
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
