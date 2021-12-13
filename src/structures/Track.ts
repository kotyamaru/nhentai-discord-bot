import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
import { PassThrough } from 'stream';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

export interface TrackData {
    url: string;
    videoURL: string;
    imageURL: string;
    title: string;
    circle: string;
    onStart: () => void;
    onFinish: () => void;
    onError: (error: Error) => void;
}

const noop = () => {};

export class Track implements TrackData {
    public readonly url: string;
    public readonly videoURL: string;
    public readonly imageURL: string;
    public readonly title: string;
    public readonly circle: string;
    public readonly onStart: () => void;
    public readonly onFinish: () => void;
    public readonly onError: (error: Error) => void;

    private constructor({
        url,
        videoURL,
        imageURL,
        title,
        circle,
        onStart,
        onFinish,
        onError,
    }: TrackData) {
        this.url = url;
        this.videoURL = videoURL;
        this.imageURL = imageURL;
        this.title = title;
        this.circle = circle;
        this.onStart = onStart;
        this.onFinish = onFinish;
        this.onError = onError;
    }

    public createAudioResource(): Promise<AudioResource<Track>> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await axios.get(this.videoURL, {
                    responseType: 'stream',
                });
                const videoStream = new PassThrough();
                response.data.pipe(videoStream);
                try {
                    const probe = await demuxProbe(
                        ffmpeg(videoStream)
                            .on('error', err => {
                                throw err;
                            })
                            .audioBitrate(100)
                            .audioFrequency(48000)
                            .audioChannels(2)
                            .format('ogg')
                            .pipe() as PassThrough
                    );
                    resolve(
                        createAudioResource(probe.stream, {
                            metadata: this,
                            inputType: probe.type,
                        })
                    );
                } catch (error) {
                    reject(error);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    public static async from(
        url: string,
        videoURL: string,
        imageURL: string,
        title: string,
        circle: string,
        methods: Pick<Track, 'onStart' | 'onFinish' | 'onError'>
    ): Promise<Track> {
        const wrappedMethods = {
            onStart() {
                wrappedMethods.onStart = noop;
                methods.onStart();
            },
            onFinish() {
                wrappedMethods.onFinish = noop;
                methods.onFinish();
            },
            onError(error: Error) {
                wrappedMethods.onError = noop;
                methods.onError(error);
            },
        };
        return new Track({
            url,
            videoURL,
            imageURL,
            title,
            circle,
            ...wrappedMethods,
        });
    }
}
