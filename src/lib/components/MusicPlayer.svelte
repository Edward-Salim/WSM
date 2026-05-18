<script>
	import { CirclePause, CirclePlay } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';

	let tracks = $state([]);

	let currentTrackIndex = $state(0);
	let isPlaying = $state(false);
	let progress = $state(0);
	let duration = $state(0);
	let audio = $state(null);
	let hasLoadedTracks = $state(false);

	const currentTrack = $derived(tracks[currentTrackIndex] ?? null);

	function shuffleTracks(list) {
		const shuffled = [...list];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	onMount(async () => {
		try {
			const response = await fetch('/api/music');
			const data = await response.json();
			tracks = Array.isArray(data.tracks) ? shuffleTracks(data.tracks) : [];
		} catch (error) {
			console.error('Failed to load music tracks:', error);
			tracks = [];
		} finally {
			hasLoadedTracks = true;
		}

		await tick();
		if (tracks.length > 0 && audio) {
			try {
				audio.load();
				await audio.play();
				isPlaying = true;
			} catch (error) {
				console.warn('Autoplay blocked or play interrupted:', error);
			}
		}
	});

	function togglePlay() {
		if (!audio || !currentTrack) return;
		if (isPlaying) {
			audio.pause();
			isPlaying = false;
		} else {
			audio
				.play()
				.then(() => {
					isPlaying = true;
				})
				.catch((err) => {
					console.warn('Autoplay blocked or play interrupted:', err);
				});
		}
	}

	function nextTrack() {
		if (tracks.length === 0) return;
		currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
		isPlaying = false;
		progress = 0;
		setTimeout(() => {
			if (audio && tracks[currentTrackIndex]) {
				audio.src = tracks[currentTrackIndex].src;
				audio.load();
				audio
					.play()
					.then(() => {
						isPlaying = true;
					})
					.catch((err) => console.warn(err));
			}
		}, 100);
	}

	function prevTrack() {
		if (tracks.length === 0) return;
		currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
		isPlaying = false;
		progress = 0;
		setTimeout(() => {
			if (audio && tracks[currentTrackIndex]) {
				audio.src = tracks[currentTrackIndex].src;
				audio.load();
				audio
					.play()
					.then(() => {
						isPlaying = true;
					})
					.catch((err) => console.warn(err));
			}
		}, 100);
	}

	function handleTimeUpdate() {
		if (!audio) return;
		progress = audio.currentTime;
	}

	function handleLoadedMetadata() {
		if (!audio) return;
		duration = Number.isFinite(audio.duration) ? audio.duration : 0;
	}

	function handleAudioEnded() {
		nextTrack();
	}

	function handleProgressClick(e) {
		if (!audio || duration === 0) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const width = rect.width;
		const clickPercent = clickX / width;
		audio.currentTime = clickPercent * duration;
		progress = audio.currentTime;
	}

	// Format time (seconds to mm:ss)
	function formatTime(secs) {
		if (isNaN(secs)) return '0:00';
		const minutes = Math.floor(secs / 60);
		const seconds = Math.floor(secs % 60);
		return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
	}
</script>

<div class="pointer-events-auto fixed bottom-6 left-1/2 z-40 w-[min(80vw,20.5rem)] -translate-x-1/2 select-none">
	<!-- Audio element -->
	<audio
		bind:this={audio}
		src={currentTrack?.src}
		autoplay
		ontimeupdate={handleTimeUpdate}
		onloadedmetadata={handleLoadedMetadata}
		onended={handleAudioEnded}
	></audio>

	<div
		class="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl transition-all duration-500 hover:border-violet-500/30"
	>
		<div
			class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-900 shadow-lg shadow-black/40"
		>
			<div
				class="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-slate-950 via-slate-800 to-slate-950 {isPlaying
					? 'animate-spin-slow'
					: ''}"
				style="animation-duration: 6s; transform-origin: center;"
			>
				<div class="absolute inset-1 rounded-full border border-white/5"></div>
				<div class="absolute inset-2.5 rounded-full border border-white/5"></div>
				<div
					class="flex h-4 w-4 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/20"
				>
					<div class="h-1.5 w-1.5 rounded-full bg-slate-950"></div>
				</div>
			</div>

			{#if isPlaying}
				<div class="absolute inset-0 flex items-center justify-center bg-violet-600/10">
					<svg
						class="h-5 w-5 text-indigo-300"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"
						/>
					</svg>
				</div>
			{/if}
		</div>

		<div class="flex min-w-0 flex-1 flex-col gap-1.5">
			<button
				type="button"
				class="flex min-w-0 flex-col items-start text-left"
				onclick={togglePlay}
				aria-label={isPlaying ? 'Pause current track' : 'Play current track'}
			>
				<span class="truncate text-xs font-bold tracking-wide text-white">
					{currentTrack?.title ?? (hasLoadedTracks ? 'No tracks found' : 'Loading tracks...')}
				</span>
				<span class="mt-0.5 truncate text-[10px] tracking-wide text-white/75">
					{#if currentTrack}
						{currentTrack.artist}
					{:else if hasLoadedTracks}
						Add audio files to `static/music`
					{:else}
						Scanning `static/music`
					{/if}
				</span>
			</button>

			<button
				type="button"
				class="relative h-1 w-full cursor-pointer overflow-hidden rounded-full bg-white/10"
				onclick={handleProgressClick}
				aria-label="Seek track"
				disabled={!currentTrack}
			>
				<div
					class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400"
					style="width: {(progress / (duration || 1)) * 100}%"
				></div>
			</button>

			<div class="flex items-center justify-between font-mono text-[9px] text-white/70 select-none">
				<span>{formatTime(progress)}</span>
				<span>{formatTime(duration)}</span>
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-1 border-l border-white/5 pl-2.5">
			<button
				onclick={prevTrack}
				class="cursor-pointer rounded-full p-1 text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
				aria-label="Previous track"
				disabled={tracks.length < 2}
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
					<path
						d="M8.445 14.83L3 10l5.445-4.83a1 1 0 011.555.83v2.84l5.445-4.83A1 1 0 0117 4.83v10.34a1 1 0 01-1.555.83L10 11.16v2.84a1 1 0 01-1.555.83z"
					/>
				</svg>
			</button>

			<button
				onclick={togglePlay}
				class="cursor-pointer rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 transition-all hover:scale-105 hover:bg-indigo-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				aria-label={isPlaying ? 'Pause' : 'Play'}
				disabled={!currentTrack}
			>
				{#if isPlaying}
					<CirclePause class="h-4 w-4" strokeWidth={2} />
				{:else}
					<CirclePlay class="h-4 w-4" strokeWidth={2} />
				{/if}
			</button>

			<button
				onclick={nextTrack}
				class="cursor-pointer rounded-full p-1 text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
				aria-label="Next track"
				disabled={tracks.length < 2}
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
					<path
						d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.16v2.84A1 1 0 0011.555 15l5-4a1 1 0 000-1.664l-5-4A1 1 0 0010 6.16v2.84L4.555 5.168z"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	@keyframes spin-slow {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	:global(.animate-spin-slow) {
		animation: spin-slow 10s linear infinite;
	}
</style>
