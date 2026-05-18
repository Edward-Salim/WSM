<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import MusicPlayer from '$lib/components/MusicPlayer.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<MusicPlayer />
