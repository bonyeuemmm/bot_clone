const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('mongoose');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID || '1208450889246048306';
const MONGO_URI = process.env.MONGO_URI;

const MAIN_SERVER_ID = '1454813193028374540';
const SERVER_INVITE_LINK = 'https://discord.gg/z7RUNArBuJ';

const COLORS = {
  DEFAULT: 0x9b59b6,
  MEMBER: 0x3498db,
  SUCCESS: 0x2ecc71,
  ADMIN: 0xf1c40f,
  OWNER: 0xe67e22,
  ERROR: 0xe74c3c
};

const FOOTER_ICON_URL = 'https://i.postimg.cc/gJbhCmHL/Pain-Gamer.png';

mongoose.connect(MONGO_URI)
  .then(() => console.log('🍃 Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  durationMs: Number,
  activatedAt: Date,
  expiresAt: Date
});

const AccessSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  expiresAt: Number,
  durationMs: Number,
  warned24h: { type: Boolean, default: false },
  warned4h: { type: Boolean, default: false }
});

const LinkSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  links: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const AdminSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }
});

const KeyModel = mongoose.model('Key', KeySchema);
const AccessModel = mongoose.model('Access', AccessSchema);
const LinkModel = mongoose.model('Link', LinkSchema);
const AdminModel = mongoose.model('Admin', AdminSchema);
const UserModel = mongoose.model('User', UserSchema);

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] 
});

const commandCooldowns = new Collection();
const COMMAND_COOLDOWN_MS = 10000;

function formatFooterText() {
  return 'Bot By PAIN';
}

function createBotEmbed({ title, description, fields, user, locale = 'vi', color = COLORS.DEFAULT, timestamp = Date.now() } = {}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setFooter({ 
      text: formatFooterText(), 
      iconURL: FOOTER_ICON_URL 
    });

  if (user) {
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }));
  }

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields?.length) embed.addFields(fields);

  return embed;
}

async function autoScanAndCleanExpiredKeys() {
  const now = Date.now();
  const allAccess = await AccessModel.find({});

  for (const userData of allAccess) {
    if (userData.expiresAt !== -1 && Number.isFinite(userData.expiresAt) && now >= userData.expiresAt) {
      try {
        const user = await client.users.fetch(userData.userId);
        await user.send({
          embeds: [
            createBotEmbed({
              title: '⏰ Thông Báo Hết Hạn Key',
              description: 'Thời hạn sử dụng bot của bạn đã hết. Quyền truy cập bot đã tự động bị thu hồi!',
              user,
              color: COLORS.ERROR
            })
          ]
        });
      } catch (_e) {}

      await AccessModel.deleteOne({ userId: userData.userId });
      continue;
    }
  }
}

setInterval(autoScanAndCleanExpiredKeys, 30000);

const commands = [
  new SlashCommandBuilder()
    .setName('setadmin')
    .setDescription('Quản lý quyền Admin Bot (Thêm hoặc Xóa)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Chọn hành động')
        .setRequired(true)
        .addChoices(
          { name: 'Add (Thêm Admin)', value: 'add' },
          { name: 'Remove (Xóa Admin)', value: 'remove' }
        )
    )
    .addUserOption(option => option.setName('user').setDescription('Chọn người dùng').setRequired(true)),

  new SlashCommandBuilder()
    .setName('createkey')
    .setDescription('Tạo key mới')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Thời hạn của key')
        .setRequired(true)
        .addChoices(
          { name: '1 Ngày', value: '1d' },
          { name: '3 Ngày', value: '3d' },
          { name: '7 Ngày', value: '7d' },
          { name: '30 Ngày', value: '30d' },
          { name: 'Vĩnh viễn', value: 'permanent' }
        )
    )
    .addUserOption(option => option
      .setName('target_user')
      .setDescription('Member nhận key (không bắt buộc)')
      .setRequired(false)),
    
  new SlashCommandBuilder()
    .setName('setlinkclone')
    .setDescription('Tải và thiết lập link + phiên bản cho từng mục')
    .addStringOption(opt => opt.setName('category').setDescription('Tên mục (VD: Delta X)').setRequired(true))
    .addStringOption(opt => opt.setName('region').setDescription('Khu vực').setRequired(true).addChoices({ name: 'Global', value: 'global' }, { name: 'VNG', value: 'vng' }))
    .addStringOption(opt => opt.setName('link').setDescription('Đường link tải').setRequired(true))
    .addStringOption(opt => opt.setName('status').setDescription('Trạng thái').setRequired(true).addChoices(
      { name: '🟢 Hoạt động', value: 'active' },
      { name: '🟡 Đang bảo trì / Chờ update', value: 'maintenance' },
      { name: '🔴 Ngừng hoạt động', value: 'disabled' }
    ))
    .addStringOption(opt => opt.setName('version').setDescription('Phiên bản (VD: v2.640)').setRequired(false))
    .addStringOption(opt => opt.setName('note').setDescription('Ghi chú / Tính năng').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Chọn bản Clone để cập nhật trạng thái'),

  new SlashCommandBuilder()
    .setName('removelink')
    .setDescription('Xóa bản Clone hoặc toàn bộ dữ liệu'),

  new SlashCommandBuilder()
    .setName('setuppanel')
    .setDescription('Tạo bảng điều khiển lấy link cố định trong channel'),

  new SlashCommandBuilder()
    .setName('redeemkey')
    .setDescription('Nhập key để kích hoạt')
    .addStringOption(option => option.setName('key').setDescription('Nhập mã key').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Kiểm tra thời hạn sử dụng bot còn lại của bạn'),

  new SlashCommandBuilder()
    .setName('removekey')
    .setDescription('Xóa key và thu hồi quyền của member')
    .addStringOption(option => option.setName('key').setDescription('Key cần xóa').setRequired(true)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn sử dụng bot'),

  new SlashCommandBuilder()
    .setName('notification')
    .setDescription('Gửi thông báo đến các member đã sử dụng bot')
    .addStringOption(option => option
      .setName('message')
      .setDescription('Nội dung thông báo muốn gửi')
      .setRequired(true)
      .setMaxLength(2000))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Registered Slash Commands successfully!');
  } catch (error) {
    console.error(error);
  }
})();

function generateRandomKey() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `pain_${randomDigits}`;
}

async function isBotAdmin(userId) {
  if (userId === OWNER_ID) return true;
  const admin = await AdminModel.findOne({ userId });
  return !!admin;
}

async function rememberUser(userId) {
  await UserModel.updateOne({ userId }, { userId }, { upsert: true });
}

function formatExpiry(expireTimestamp) {
  if (expireTimestamp === -1) return 'Vĩnh viễn';
  if (expireTimestamp == null) return 'Chưa kích hoạt';
  return `<t:${Math.floor(expireTimestamp / 1000)}:R>`;
}

function getDurationMilliseconds(duration) {
  if (duration === '1d') return 1 * 24 * 60 * 60 * 1000;
  if (duration === '3d') return 3 * 24 * 60 * 60 * 1000;
  if (duration === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (duration === '30d') return 30 * 24 * 60 * 60 * 1000;
  if (duration === 'permanent') return -1;
  return null;
}

function formatDuration(durationMs) {
  if (durationMs === -1) return 'Vĩnh viễn kể từ lúc redeem';
  if (durationMs == null) return 'Theo thời hạn cũ của key';
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  return `${durationDays} ngày kể từ lúc redeem`;
}

async function getValidAccessKey(userId) {
  const userData = await AccessModel.findOne({ userId });
  if (!userData) return null;

  const now = Date.now();
  if (userData.expiresAt !== -1 && Number.isFinite(userData.expiresAt) && now >= userData.expiresAt) {
    await AccessModel.deleteOne({ userId });
    return null;
  }

  return userData;
}

client.on('interactionCreate', async interaction => {
  if (!interaction.guildId) {
    return await interaction.reply({
      embeds: [createBotEmbed({
        title: '⛔ KHÔNG THỂ SỬ DỤNG TRONG DM',
        description: `Vui lòng tham gia **Server Chính Thức** để sử dụng tính năng!\n\n👉 [**[ BẤM VÀO ĐÂY ĐỂ VÀO SERVER ]**](${SERVER_INVITE_LINK})`,
        color: COLORS.ERROR
      })],
      ephemeral: true
    });
  }

  if (interaction.guildId !== MAIN_SERVER_ID) {
    return await interaction.reply({
      embeds: [createBotEmbed({
        title: '🏰 MÁY CHỦ BẢO HỘ',
        description: `Bot chỉ hỗ trợ hoạt động tại **Server Chính Thức (Nhà Của Bot)**.\n\n👉 [**[ BẤM VÀO ĐÂY ĐỂ VỀ SERVER NHÀ ]**](${SERVER_INVITE_LINK})`,
        color: COLORS.ERROR
      })],
      ephemeral: true
    });
  }

  const userId = interaction.user.id;
  const userLocale = interaction.locale || 'vi';

  if (userId !== OWNER_ID) {
    const now = Date.now();
    const lastInteractionAt = commandCooldowns.get(userId);

    if (lastInteractionAt && now - lastInteractionAt < COMMAND_COOLDOWN_MS) {
      const remainingTime = Math.ceil((COMMAND_COOLDOWN_MS - (now - lastInteractionAt)) / 1000);
      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '⚠️ Anti-Spam System',
            description: `Bạn đang thao tác quá nhanh, vui lòng đợi **${remainingTime}s** nữa để sử dụng lại lệnh!`,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.OWNER
          })
        ],
        ephemeral: true
      });
    }

    commandCooldowns.set(userId, now);
  }

  await rememberUser(interaction.user.id);

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setuppanel') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const panelEmbed = createBotEmbed({
        title: '🎮 HỆ THỐNG LẤY CLONE ROBLOX PREMIUM',
        description: 'Vui lòng bấm nút bên dưới để lấy roblox và executor premium!',
        color: COLORS.DEFAULT
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_type_premium').setLabel('Get Clone').setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({ embeds: [panelEmbed], components: [row] });
      return await interaction.reply({ content: '✅ Đã tạo Panel thành công!', ephemeral: true });
    }

    if (commandName === 'setstatus') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const allLinks = await LinkModel.find({});
      if (allLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: 'Hiện chưa có bản Clone nào được thiết lập trong hệ thống!',
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = allLinks.map(item => ({
        label: item.category,
        description: `Mục: ${item.category}`,
        value: JSON.stringify({ cat: item.category })
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_setstatus_category')
        .setPlaceholder('--- Chọn mục Clone muốn cập nhật trạng thái ---')
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: '⚙️ CẬP NHẬT TRẠNG THÁI CLONE',
          description: 'Vui lòng chọn mục Clone bạn muốn thay đổi trạng thái:',
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'removelink') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const allLinks = await LinkModel.find({});
      if (allLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: 'Không có dữ liệu Clone nào trong hệ thống để xóa!',
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = [
        {
          label: '🔥 [XÓA TẤT CẢ PHIÊN BẢN CLONE]',
          description: 'Xóa toàn bộ tất cả bản Clone và khu vực khỏi hệ thống!',
          value: JSON.stringify({ action: 'DELETE_ALL' })
        },
        ...allLinks.map(item => ({
          label: `📌 ${item.category}`,
          description: `Chọn để xóa toàn bộ dữ liệu của ${item.category}`,
          value: JSON.stringify({ action: 'DELETE_ONE', cat: item.category })
        }))
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_remove_category')
        .setPlaceholder('--- Chọn mục Clone muốn xóa ---')
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: '🗑️ XÓA PHIÊN BẢN CLONE',
          description: 'Chọn mục Clone cụ thể hoặc chọn **[XÓA TẤT CẢ]** để làm sạch cơ sở dữ liệu:',
          color: COLORS.ERROR
        })],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'status') {
      const userData = await getValidAccessKey(interaction.user.id);

      if (!userData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '📊 Trạng Thái Tài Khoản',
              description: 'Bạn chưa kích hoạt key hoặc thời hạn đã hết. Hãy nhập key bằng lệnh `/redeemkey`!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      if (userData.expiresAt === -1) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '📊 Trạng Thái Tài Khoản',
              description: 'Thời hạn sử dụng bot của bạn là **Vĩnh viễn**!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.SUCCESS
            })
          ],
          ephemeral: true
        });
      }

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '📊 Trạng Thái Tài Khoản',
            description: `Thời hạn sử dụng bot còn lại là ${formatExpiry(userData.expiresAt)}. Bạn chỉ cần nhập 1 key mới ở lệnh /redeemkey có thể cộng dồn thêm thời hạn!`,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.MEMBER
          })
        ],
        ephemeral: true
      });
    }

    if (commandName === 'help') {
      const helpEmbed = createBotEmbed({
        title: '📖 Hướng dẫn sử dụng hệ thống',
        description: 'Dưới đây là các lệnh sẵn có trong bot.',
        user: interaction.user,
        locale: userLocale,
        color: COLORS.MEMBER,
        fields: [
          {
            name: '👥 Dành cho Member',
            value: [
              '`/redeemkey key:<mã-key>` — Nhập key kích hoạt.',
              '`/status` — Kiểm tra thời hạn sử dụng bot còn lại.'
            ].join('\n')
          },
          {
            name: '🛠️ Dành cho Admin',
            value: [
              '`/setuppanel` — Tạo bảng điều khiển lấy link.',
              '`/setlinkclone category:<mục> region:<Global/VNG> link:<URL> status:<trạng-thái>` — Cập nhật link Premium.',
              '`/setstatus` — Chọn mục Clone để thay đổi trạng thái nhanh.',
              '`/removelink` — Xóa mục Clone theo khu vực hoặc xóa tất cả.',
              '`/createkey duration:<thời-hạn> target_user:<member>` — Tạo key kích hoạt.'
            ].join('\n')
          },
          {
            name: '👑 Dành cho Owner',
            value: [
              '`/setadmin action:<Add/Remove> user:<member>` — Thêm hoặc xóa Admin.',
              '`/removekey key:<mã-key>` — Xóa vĩnh viễn key chưa sử dụng.',
              '`/notification message:<nội-dung>` — Gửi tin nhắn hàng loạt qua DM.'
            ].join('\n')
          }
        ]
      });

      return await interaction.reply({
        embeds: [helpEmbed],
        ephemeral: false
      });
    }

    if (commandName === 'notification') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Không đủ thẩm quyền',
              description: 'Chỉ Chủ sở hữu Bot (Owner) mới có quyền dùng lệnh này!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const message = interaction.options.getString('message', true).trim();
      await interaction.deferReply({ ephemeral: true });

      const allUsers = await UserModel.find({});
      let successCount = 0;
      let failedCount = 0;

      for (const doc of allUsers) {
        try {
          const user = await client.users.fetch(doc.userId);
          await user.send({
            embeds: [
              createBotEmbed({
                title: '👑 Thông Báo Từ Owner',
                description: message,
                user,
                locale: userLocale,
                color: COLORS.OWNER
              })
            ]
          });
          successCount += 1;
        } catch (_error) {
          failedCount += 1;
        }
      }

      return await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '📢 Kết quả gửi thông báo',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: '✅ Gửi thành công', value: `${successCount} member`, inline: true },
              { name: '❌ Gửi thất bại', value: `${failedCount} member`, inline: true }
            ],
            color: COLORS.SUCCESS
          })
        ]
      });
    }

    if (commandName === 'setadmin') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Lỗi phân quyền',
              description: 'Chỉ Owner mới có thẩm quyền quản trị danh sách Admin.',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const action = interaction.options.getString('action', true);
      const targetUser = interaction.options.getUser('user', true);

      if (action === 'add') {
        await AdminModel.updateOne({ userId: targetUser.id }, { userId: targetUser.id }, { upsert: true });
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '✅ Thêm Admin thành công',
              description: `Đã cấp quyền Admin cho: **${targetUser.tag}**`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.OWNER
            })
          ],
          ephemeral: true
        });
      } else if (action === 'remove') {
        await AdminModel.deleteOne({ userId: targetUser.id });
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '✅ Thu hồi Admin thành công',
              description: `Đã xóa quyền Admin của: **${targetUser.tag}**`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.OWNER
            })
          ],
          ephemeral: true
        });
      }
    }

    if (commandName === 'setlinkclone') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Quyền truy cập bị từ chối',
              description: 'Bạn không có quyền thực hiện thiết lập link.',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const category = interaction.options.getString('category').trim();
      const region = interaction.options.getString('region');
      const link = interaction.options.getString('link').trim();
      const status = interaction.options.getString('status');
      const version = interaction.options.getString('version') || 'v1.0';
      const note = interaction.options.getString('note') || 'Không có ghi chú thêm';

      let linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc) {
        linkDoc = new LinkModel({ category, links: { premium: {} } });
      }

      if (!linkDoc.links) linkDoc.links = {};
      if (!linkDoc.links.premium) linkDoc.links.premium = {};

      linkDoc.links.premium[region] = { url: link, version, note, status };
      
      linkDoc.markModified('links');
      await linkDoc.save();

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Thêm/Cập Nhật Link Thành Công',
            fields: [
              { name: 'Mục', value: category, inline: true },
              { name: 'Gói', value: 'PREMIUM', inline: true },
              { name: 'Khu vực', value: region.toUpperCase(), inline: true },
              { name: 'Phiên bản', value: version, inline: true },
              { name: 'Ghi chú', value: note, inline: true },
              { name: 'Link Tải', value: link }
            ],
            color: COLORS.ADMIN
          })
        ],
        ephemeral: true
      });
    }

    else if (commandName === 'createkey') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Từ chối truy cập',
              description: 'Bạn không có thẩm quyền tạo key!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const duration = interaction.options.getString('duration');
      const targetUser = interaction.options.getUser('target_user');
      await interaction.deferReply({ ephemeral: true });
      
      let generatedKey = generateRandomKey();
      while (await KeyModel.findOne({ key: generatedKey })) { 
        generatedKey = generateRandomKey(); 
      }

      const durationMs = getDurationMilliseconds(duration);
      await KeyModel.create({
        key: generatedKey,
        durationMs,
        activatedAt: null,
        expiresAt: null
      });

      const durationText = formatDuration(durationMs);
      let targetUserDetails = 'Không gửi cho member cụ thể';
      let isDirectSent = false;

      if (targetUser) {
        try {
          const fetchedTargetUser = await client.users.fetch(targetUser.id);
          await fetchedTargetUser.send({
            embeds: [
              createBotEmbed({
                title: '🔑 Nhận Mã Key Mới',
                user: fetchedTargetUser,
                locale: userLocale,
                fields: [
                  { name: 'Mã Key', value: `\`\`\`\n${generatedKey}\n\`\`\`` },
                  { name: 'Thời hạn', value: durationText },
                  { name: 'Hướng dẫn', value: `Sử dụng lệnh \`/redeemkey key:${generatedKey}\` để mở khóa bot.` }
                ],
                color: COLORS.MEMBER
              })
            ]
          });
          isDirectSent = true;
          targetUserDetails = `Đã gửi cho ${fetchedTargetUser.tag} (ID:${fetchedTargetUser.id})`;
        } catch (error) {
          targetUserDetails = `Gửi thất bại cho ${targetUser.tag} (ID:${targetUser.id})`;
        }
      }

      await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '🔑 Tạo Key Thành Công',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Mã Key', value: `\`\`\`\n${generatedKey}\n\`\`\``, inline: false },
              { name: 'Thời hạn', value: durationText, inline: true },
              { name: 'Trạng thái DM', value: isDirectSent ? '✅ Đã gửi DM' : (targetUser ? '❌ Lỗi gửi DM' : 'Không gửi'), inline: true }
            ],
            color: COLORS.ADMIN
          })
        ]
      });
    }

    else if (commandName === 'removekey') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Thất bại',
              description: 'Chỉ Owner mới có quyền thu hồi/xóa key!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const userKey = interaction.options.getString('key', true).trim();
      await KeyModel.deleteOne({ key: userKey });

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Đã Xóa Key',
            description: `Đã xóa vĩnh viễn key chưa sử dụng:\n\`\`\`\n${userKey}\n\`\`\``,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.OWNER
          })
        ],
        ephemeral: true
      });
    }

    else if (commandName === 'redeemkey') {
      const userKey = interaction.options.getString('key').trim();
      const keyData = await KeyModel.findOne({ key: userKey });

      if (!keyData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Key Không Hợp Lệ',
              description: `Mã key:\n\`\`\`\n${userKey}\n\`\`\`\nkhông tồn tại hoặc đã nhập sai!`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const now = Date.now();
      let currentUserData = await AccessModel.findOne({ userId: interaction.user.id });
      let newExpiresAt = now;

      if (keyData.durationMs === -1) {
        newExpiresAt = -1;
      } else {
        if (currentUserData && currentUserData.expiresAt > now && currentUserData.expiresAt !== -1) {
          newExpiresAt = currentUserData.expiresAt + keyData.durationMs;
        } else {
          newExpiresAt = now + keyData.durationMs;
        }
      }

      await AccessModel.updateOne(
        { userId: interaction.user.id },
        {
          userId: interaction.user.id,
          expiresAt: newExpiresAt,
          durationMs: keyData.durationMs,
          warned24h: false,
          warned4h: false
        },
        { upsert: true }
      );

      await KeyModel.deleteOne({ key: userKey });

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🎉 Kích Hoạt Thành Công',
            description: `Bạn đã kích hoạt thành công key:\n\`\`\`\n${userKey}\n\`\`\``,
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Thời hạn hết hạn', value: formatExpiry(newExpiresAt) }
            ],
            color: COLORS.SUCCESS
          })
        ],
        ephemeral: true
      });
    }
  }

  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId === 'btn_type_premium') {
      if (!(await getValidAccessKey(interaction.user.id))) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '🔒 Truy Cập Bị Khóa',
            description: 'Bạn chưa kích hoạt key hoặc key đã hết hạn! Dùng `/redeemkey` để kích hoạt.',
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const subEmbed = createBotEmbed({
        title: '🌐 HỆ THỐNG CHỌN KHU VỰC ROBLOX',
        description: 'Vui lòng chọn khu vực game của bạn',
        color: COLORS.ADMIN
      });

      const regionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_reg_premium_global').setLabel('🌍 Global').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_reg_premium_vng').setLabel('🇻🇳 VNG').setStyle(ButtonStyle.Success)
      );

      return await interaction.reply({ embeds: [subEmbed], components: [regionRow], ephemeral: true });
    }

    if (customId.startsWith('btn_reg_')) {
      const [, , type, region] = customId.split('_');

      const allLinks = await LinkModel.find({});
      
      const filteredLinks = allLinks.filter(item => {
        return item.links && item.links.premium && item.links.premium[region] && item.links.premium[region].url;
      });

      if (filteredLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: `Hiện chưa có bản Clone nào khả dụng cho khu vực **${region.toUpperCase()}**!`,
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      // ĐÂY LÀ PHƯƠNG ÁN 2: Mã hóa giá trị thành chuỗi JSON
      const options = filteredLinks.map(item => {
        const data = item.links.premium[region];
        const vText = data.version || 'v1.0';
        const nText = data.note || 'Không ghi chú';
        return {
          label: `${item.category} [${vText}]`,
          description: `Phiên bản: ${vText} -${nText}`.slice(0, 100),
          value: JSON.stringify({ cat: item.category, reg: region })
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_clone_item')
        .setPlaceholder(`--- Chọn bản Clone (${region.toUpperCase()}) ---`)
        .addOptions(options.slice(0, 25));

      const responseEmbed = createBotEmbed({
        title: `👇 DANH SÁCH BẢN CLONE (${region.toUpperCase()})`,
        description: `Vui lòng chọn phiên bản **${region.toUpperCase()}** bạn muốn tải từ menu bên dưới:`,
        color: COLORS.DEFAULT
      });

      return await interaction.reply({
        embeds: [responseEmbed],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const { customId } = interaction;

    if (customId === 'select_clone_item') {
      await interaction.deferUpdate();

      // ĐÂY LÀ PHƯƠNG ÁN 2: Giải mã JSON an toàn tuyệt đối
      const { cat: category, reg: region } = JSON.parse(interaction.values[0]);

      if (!(await getValidAccessKey(interaction.user.id))) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '🔒 Truy Cập Bị Khóa',
            description: 'Key của bạn đã hết hạn!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      const linkDoc = await LinkModel.findOne({ category });
      const itemData = linkDoc?.links?.premium?.[region];

      if (!itemData || !itemData.url) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: 'Link này vừa bị gỡ hoặc không tồn tại!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      const statusMap = {
        active: { text: '🟢 Đang hoạt động', allowDownload: true },
        maintenance: { text: '🟡 Đang bảo trì / Chờ update', allowDownload: false },
        disabled: { text: '🔴 Ngừng hoạt động', allowDownload: false }
      };

      const currentStatus = statusMap[itemData.status || 'active'];

      const resultEmbed = createBotEmbed({
        title: `👑 PHIÊN BẢN PREMIUM: ${category.toUpperCase()} (${region.toUpperCase()})`,
        fields: [
          { name: '📦 Gói dịch vụ', value: '`PREMIUM`', inline: true },
          { name: '🌐 Máy chủ', value: `\`${region.toUpperCase()}\``, inline: true },
          { name: '📌 Phiên bản', value: `\`${itemData.version || 'Mới nhất'}\``, inline: true },
          { name: '📊 Trạng thái', value: `\`${currentStatus.text}\``, inline: false },
          { 
            name: '🔗 Đường dẫn tải xuống', 
            value: currentStatus.allowDownload 
              ? `${itemData.url}`
              : `⚠️ Link tải tạm thời ẩn do bản Clone đang ${currentStatus.text}. Vui lòng chờ Admin cập nhật!`
          },
          { name: '📝 Ghi chú & Tính năng', value: `\`\`\`${itemData.note || 'Không có ghi chú'}\`\`\`` }
        ],
        color: currentStatus.allowDownload ? COLORS.SUCCESS : COLORS.ERROR,
        user: interaction.user
      });

      return await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }

    if (customId === 'admin_select_remove_category') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const data = JSON.parse(interaction.values[0]);

      if (data.action === 'DELETE_ALL') {
        await LinkModel.deleteMany({});
        return await interaction.update({
          embeds: [createBotEmbed({
            title: '🗑️ Xóa Thành Công',
            description: 'Đã xóa toàn bộ dữ liệu tất cả bản Clone khỏi hệ thống!',
            color: COLORS.SUCCESS
          })],
          components: []
        });
      }

      await LinkModel.deleteOne({ category: data.cat });
      return await interaction.update({
        embeds: [createBotEmbed({
          title: '🗑️ Xóa Thành Công',
          description: `Đã xóa thành công mục Clone **${data.cat}** khỏi hệ thống!`,
          color: COLORS.SUCCESS
        })],
        components: []
      });
    }

    if (customId === 'admin_select_setstatus_category') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const { cat: selectedCategory } = JSON.parse(interaction.values[0]);

      const statusSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_apply_status|${selectedCategory}`)
        .setPlaceholder(`--- Chọn trạng thái mới cho ${selectedCategory} ---`)
        .addOptions([
          { label: '🟢 Hoạt động', value: 'active', description: 'Cho phép member tải xuống bình thường' },
          { label: '🟡 Đang bảo trì / Chờ update', value: 'maintenance', description: 'Ẩn link tải và hiển thị cảnh báo' },
          { label: '🔴 Ngừng hoạt động', value: 'disabled', description: 'Ẩn link tải do ngừng hỗ trợ' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `⚙️ ĐỔI TRẠNG THÁI: ${selectedCategory}`,
          description: `Vui lòng chọn trạng thái mới áp dụng cho **tất cả khu vực** của ${selectedCategory}:`,
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(statusSelectMenu)]
      });
    }

    if (customId.startsWith('admin_apply_status|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const category = customId.split('|')[1];
      const newStatus = interaction.values[0];

      const linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc || !linkDoc.links || !linkDoc.links.premium) {
        return await interaction.update({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: 'Dữ liệu không tồn tại hoặc đã bị xóa!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      for (const reg in linkDoc.links.premium) {
        if (linkDoc.links.premium[reg]) {
          linkDoc.links.premium[reg].status = newStatus;
        }
      }

      linkDoc.markModified('links');
      await linkDoc.save();

      const statusNames = {
        active: '🟢 Hoạt động',
        maintenance: '🟡 Đang bảo trì / Chờ update',
        disabled: '🔴 Ngừng hoạt động'
      };

      return await interaction.update({
        embeds: [createBotEmbed({
          title: '✅ Cập Nhật Trạng Thái Thành Công',
          description: `Đã đổi trạng thái của **${category}** thành: **${statusNames[newStatus]}**`,
          color: COLORS.SUCCESS
        })],
        components: []
      });
    }
  }
});

client.once('ready', () => { 
  console.log(`🤖 Bot ${client.user.tag} đã sẵn sàng hoạt động!`); 
});

client.login(TOKEN);