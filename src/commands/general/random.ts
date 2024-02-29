import { Client, Command, UserError } from '@structures';
import { CommandInteraction, Message } from 'discord.js';
import { User, Server, Blacklist } from '@database/models';

export default class extends Command {
    constructor(client: Client) {
        super(client, {
            name: 'random',
            type: 'CHAT_INPUT',
            description: 'Shows a random gallery',
            cooldown: 20000,
            nsfw: true,
            options: [
                {
                    name: 'page',
                    type: 'INTEGER',
                    description: 'Starting page number (default: 1)',
                },
                {
                    name: 'more',
                    type: 'BOOLEAN',
                    description: 'Views more info about the doujin (default: false)',
                },
            ],
        });
    }

    danger = false;
    warning = false;
    blacklists: Blacklist[] = [];

    async before(interaction: CommandInteraction) {
        try {
            let user = await User.findOne({ userID: interaction.user.id }).exec();
            if (!user) {
                user = await new User({
                    userID: interaction.user.id,
                    blacklists: [],
                    anonymous: true,
                }).save();
            }
            this.blacklists = user.blacklists;
            let server = await Server.findOne({ serverID: interaction.guild.id }).exec();
            if (!server) {
                server = await new Server({
                    serverID: interaction.guild.id,
                    settings: { danger: false },
                }).save();
            }
            this.danger = server.settings.danger;
            this.warning = false;
        } catch (err) {
            this.client.logger.error(err);
            throw new Error(`Database error: ${err.message}`);
        }
    }

    async exec(interaction: CommandInteraction) {
        await this.before(interaction);
        const more = interaction.options.get('more')?.value as boolean;
        const page = (interaction.options.get('page')?.value as number) ?? 1;
        const id = await this.client.db.cache.safeRandom(this.danger, this.blacklists.map(({ id }) => id));
        if (!id) {
            throw new UserError('NO_RESULT');
        }
        const data = await this.client.nhentai.g(id)
            .catch(err => this.client.logger.error(err.message));
        if (!data || !data.gallery) {
            throw new UserError('NO_RESULT');
        }
        const { gallery } = data;
        if (page < 1 || page > gallery.num_pages) {
            throw new UserError('INVALID_PAGE_INDEX', page, gallery.num_pages);
        }

        const { displayGallery, rip } = this.client.embeds.displayFullGallery(
            gallery,
            page - 1,
            this.danger,
            this.blacklists
        );
        if (rip) this.warning = true;
        await displayGallery.run(interaction, `> **Searching for random gallery**`);

        if (more) {
            const { related, comments } = data;

            const { displayList: displayRelated, rip } = this.client.embeds.displayGalleryList(
                related,
                this.danger
            );
            if (rip) this.warning = true;
            await displayRelated.run(interaction, '> **More Like This**');

            if (!comments.length) return;
            const displayComments = this.client.embeds.displayCommentList(comments);
            await displayComments.run(interaction, '> `💬` **Comments**');
        }

        if (!this.danger && this.warning && !this.client.warned.has(interaction.user.id)) {
            this.client.warned.add(interaction.user.id);
            await interaction.followUp(this.client.util.communityGuidelines());
        }
    }
}
