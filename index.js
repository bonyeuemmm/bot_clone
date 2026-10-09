eral: true });

      const allLinks = await LinkModel.find({});
      if (allLinks.length === 0) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Thao tác thất bại',
              description: 'Không có dữ liệu Clone nào trong hệ thống để xóa!',
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const options = [
        {
          label: '🔥 [XÓA TẤT CẢ DỮ LIỆU HỆ THỐNG]',
          description: 'Xóa toàn bộ tất cả bản Clone (Cả Free và Premium) khỏi database!',
          value: JSON.stringify({ action: 'DELETE_ALL' })
        },
        ...allLinks.map(item => ({
          label: `📌 Mục: ${item.category}`,
          description: `Chọn để xóa theo khu vực hoặc xóa toàn bộ mục ${item.category}`,
          value: JSON.stringify({ action: 'CHOOSE_CAT', cat: item.category })
        }))
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_remove_category')
        .setPlaceholder('--- Chọn mục Clone muốn xóa ---')
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🗑️ XÓA PHIÊN BẢN CLONE',
            description: 'Chọn mục Clone cụ thể hoặc tùy chọn xóa toàn bộ hệ thống:',
            color: COLORS.ERROR
          })
        ],
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

    if (commandName === 'token') {
      const wantReset = interaction.options.getBoolean('reset') === true;
      let authDoc = await AuthModel.findOne({ userId: interaction.user.id });

      if (wantReset || !authDoc) {
        const newToken = generateLoginToken();
        if (authDoc) {
          authDoc.token = newToken;
          await authDoc.save();
        } else {
          authDoc = await AuthModel.create({ userId: interaction.user.id, token: newToken });
        }

        return await interaction.reply({
          embeds: [createBotEmbed({
            title: wantReset ? '🔁 Đã Reset Token Website' : '🔑 Token Đăng Nhập Website',
            description: [
              '⚠️ **TUYỆT ĐỐI KHÔNG chia sẻ token này cho bất kỳ ai khác!** Ai có token này có thể đăng nhập vào tài khoản Website của bạn.',
              wantReset ? 'Token cũ đã ngừng hoạt động ngay lập tức.' : 'Dùng lệnh /token reset:true bất cứ lúc nào nếu muốn tạo Token mới.'
            ].join('\n'),
            fields: [{ name: 'Token mới của bạn', value: authDoc.token }],
            user: interaction.user,
            locale: userLocale,
            color: COLORS.SUCCESS
          })],
          ephemeral: true
        });
      }

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: '🔑 Token Đăng Nhập Website',
          description: [
            '⚠️ **TUYỆT ĐỐI KHÔNG chia sẻ token này cho bất kỳ ai khác!** Ai có token này có thể đăng nhập vào tài khoản Website của bạn.',
            'Dùng lệnh /token reset:true bất cứ lúc nào nếu muốn tạo Token mới.'
          ].join('\n'),
          fields: [{ name: 'Token của bạn', value: authDoc.token }],
          user: interaction.user,
          locale: userLocale,
          color: COLORS.DEFAULT
        })],
        ephemeral: true
      });
    }

    if (commandName === '2fa') {
      let authDoc = await AuthModel.findOne({ userId: interaction.user.id });
      if (!authDoc) {
        authDoc = await AuthModel.create({ userId: interaction.user.id, token: generateLoginToken() });
      }

      const code = generate2FACode();
      authDoc.twoFACode = code;
      authDoc.twoFACodeExpiresAt = Date.now() + TWOFA_TTL_MS;
      await authDoc.save();

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: '🔐 Mã Xác Thực 2FA',
          description: [
            '⏰ Mã sẽ hết hạn sau **5 phút**.',
            '⚠️ **TUYỆT ĐỐI KHÔNG chia sẻ mã này cho bất kỳ ai khác!**',
            'Nhập đúng mã này trên Website (sau khi nhập Token) mới có thể hoàn tất đăng nhập. Lưu ý: đăng nhập Website là **không bắt buộc**, bạn vẫn có thể duyệt web bình thường mà không cần đăng nhập.'
          ].join('\n'),
          fields: [{ name: 'Mã 2FA của bạn', value: code }],
          user: interaction.user,
          locale: userLocale,
          color: COLORS.ADMIN
        })],
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
              '`/getclonepre region:<Global/VNG>` — Lấy link Clone Premium (Cần Key).',
              '`/getclonefree region:<Global/VNG>` — Lấy link Clone Miễn Phí.',
              '`/redeemkey key:<mã-key>` — Nhập key kích hoạt.',
              '`/status` — Kiểm tra thời hạn sử dụng bot còn lại.',
              '`/token reset:<true/false>` — Lấy (hoặc reset) Token đăng nhập Website (không bắt buộc).',
              '`/2fa` — Lấy mã 2FA 6 ký tự để hoàn tất đăng nhập Website.'
            ].join('\n')
          },
          {
            name: '🛠️ Dành cho Admin',
            value: [
              '`/setlinkclone type:<Free/Premium> category:<mục> region:<Global/VNG> link:<URL> status:<trạng-thái>` — Cập nhật link.',
              '`/setstatus` — Chọn mục Clone & khu vực để thay đổi trạng thái nhanh.',
              '`/removelink` — Xóa mục Clone theo khu vực cụ thể hoặc xóa tất cả.',
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

      return await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
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

      const type = interaction.options.getString('type');
      const category = interaction.options.getString('category').trim();
      const region = interaction.options.getString('region');
      const link = interaction.options.getString('link').trim();
      const status = interaction.options.getString('status');
      const version = interaction.options.getString('version') || 'v1.0';
      const note = interaction.options.getString('note') || 'Không có ghi chú thêm';

      let linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc) {
        linkDoc = new LinkModel({ category, links: { free: {}, premium: {} } });
      }

      if (!linkDoc.links) linkDoc.links = { free: {}, premium: {} };
      if (!linkDoc.links[type]) linkDoc.links[type] = {};

      linkDoc.links[type][region] = { url: link, version, note, status };
      
      linkDoc.markModified('links');
      await linkDoc.save();

      // GỬI LOG VỀ OWNER
      await sendOwnerLog('Cập Nhật Link Clone', [
        { name: 'Mục', value: category, inline: true },
        { name: 'Loại', value: type.toUpperCase(), inline: true },
        { name: 'Khu vực', value: region.toUpperCase(), inline: true },
        { name: 'Phiên bản', value: version, inline: true },
        { name: 'Link tải', value: link, inline: false }
      ], interaction.user);

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Thêm/Cập Nhật Link Thành Công',
            fields: [
              { name: 'Mục', value: category, inline: true },
              { name: 'Gói', value: type.toUpperCase(), inline: true },
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
                  { name: 'Mã Key', value: generatedKey },
                  { name: 'Thời hạn', value: durationText },
                  { name: 'Hướng dẫn', value: 'Sử dụng lệnh /redeemkey và nhập Mã Key ở trên để mở khóa bot.' }
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

      // GỬI LOG VỀ OWNER
      await sendOwnerLog('Tạo Key Mới', [
        { name: 'Mã Key', value: generatedKey, inline: true },
        { name: 'Thời hạn', value: durationText, inline: true },
        { name: 'Gửi DM cho', value: targetUser ? targetUser.tag : 'Không chọn', inline: true }
      ], interaction.user);

      await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '🔑 Tạo Key Thành Công',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Mã Key', value: generatedKey, inline: false },
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
            description: 'Đã xóa vĩnh viễn key chưa sử dụng.',
            fields: [{ name: 'Mã Key', value: userKey }],
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
              description: 'Key không tồn tại hoặc đã nhập sai!',
              fields: [{ name: 'Mã Key', value: userKey }],
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
            description: 'Bạn đã kích hoạt thành công key.',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Mã Key', value: userKey },
              { name: 'Thời hạn hết hạn', value: formatExpiry(newExpiresAt) }
            ],
            color: COLORS.SUCCESS
          })
        ],
        ephemeral: true
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const { customId } = interaction;

    if (customId === 'user_select_clone_pre_category') {
      await interaction.deferUpdate();

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
          { name: '📝 Ghi chú', value: itemData.note || 'Không có ghi chú', inline: false },
          { 
            name: '🔗 Đường dẫn tải xuống', 
            value: currentStatus.allowDownload 
              ? `${itemData.url}\n\n⚠️ **LƯU Ý:** Nghiêm cấm chia sẻ link ra ngoài, vi phạm sẽ bị khóa key vĩnh viễn!`
              : `⚠️ Link tải tạm thời ẩn do bản Clone đang ${currentStatus.text}. Vui lòng chờ Admin cập nhật!`
          }
        ],
        user: interaction.user,
        color: currentStatus.allowDownload ? COLORS.SUCCESS : COLORS.ERROR
      });

      return await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }

    if (customId === 'user_select_clone_free_category') {
      await interaction.deferUpdate();

      const { cat: category, reg: region } = JSON.parse(interaction.values[0]);

      const linkDoc = await LinkModel.findOne({ category });
      const itemData = linkDoc?.links?.free?.[region];

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
        title: `🎁 PHIÊN BẢN MIỄN PHÍ: ${category.toUpperCase()} (${region.toUpperCase()})`,
        fields: [
          { name: '📦 Gói dịch vụ', value: '`FREE`', inline: true },
          { name: '🌐 Máy chủ', value: `\`${region.toUpperCase()}\``, inline: true },
          { name: '📌 Phiên bản', value: `\`${itemData.version || 'Mới nhất'}\``, inline: true },
          { name: '📊 Trạng thái', value: `\`${currentStatus.text}\``, inline: false },
          { name: '📝 Ghi chú', value: itemData.note || 'Không có ghi chú', inline: false },
          { 
            name: '🔗 Đường dẫn tải xuống', 
            value: currentStatus.allowDownload 
              ? `${itemData.url}\n\n💡 Bản Free dành cho tất cả thành viên. Chúc bạn chơi game vui vẻ!`
              : `⚠️ Link tải tạm thời ẩn do bản Clone đang ${currentStatus.text}. Vui lòng chờ Admin cập nhật!`
          }
        ],
        user: interaction.user,
        color: currentStatus.allowDownload ? COLORS.MEMBER : COLORS.ERROR
      });

      return await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }

    if (customId === 'admin_select_remove_category') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const data = JSON.parse(interaction.values[0]);

      if (data.action === 'DELETE_ALL') {
        await LinkModel.deleteMany({});
        
        await sendOwnerLog('Xóa Tất Cả Dữ Liệu Clone', [
          { name: 'Chi tiết', value: 'Admin đã xóa sạch toàn bộ bản Clone trong Database' }
        ], interaction.user);

        return await interaction.update({
          embeds: [createBotEmbed({
            title: '🗑️ Xóa Thành Công',
            description: 'Đã xóa toàn bộ dữ liệu tất cả bản Clone khỏi hệ thống!',
            color: COLORS.SUCCESS
          })],
          components: []
        });
      }

      const selectedCat = data.cat;
      const regionSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_remove_region|${selectedCat}`)
        .setPlaceholder(`--- Chọn khu vực cần xóa của ${selectedCat} ---`)
        .addOptions([
          { label: '🌍 Global', value: 'global', description: 'Xóa bản Clone thuộc khu vực Global' },
          { label: '🇻🇳 VNG', value: 'vng', description: 'Xóa bản Clone thuộc khu vực VNG' },
          { label: '🔥 Xóa toàn bộ mục này (Cả Global & VNG)', value: 'DELETE_WHOLE_CAT', description: 'Xóa sạch mục này khỏi database' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `🗑️ XÓA CLONE: ${selectedCat}`,
          description: `Vui lòng chọn khu vực bạn muốn xóa cho mục **${selectedCat}**:`,
          color: COLORS.ERROR
        })],
        components: [new ActionRowBuilder().addComponents(regionSelectMenu)]
      });
    }

    if (customId.startsWith('admin_remove_region|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const category = customId.split('|')[1];
      const selectedValue = interaction.values[0];
      const linkDoc = await LinkModel.findOne({ category });

      if (!linkDoc) {
        return await interaction.update({
          embeds: [createBotEmbed({ title: '❌ Lỗi', description: 'Dữ liệu không tồn tại!', color: COLORS.ERROR })],
          components: []
        });
      }

      if (selectedValue === 'DELETE_WHOLE_CAT') {
        await LinkModel.deleteOne({ category });

        await sendOwnerLog('Xóa Danh Mục Clone', [
          { name: 'Mục bị xóa', value: category, inline: true },
          { name: 'Phạm vi', value: 'Toàn bộ khu vực', inline: true }
        ], interaction.user);

        return await interaction.update({
          embeds: [createBotEmbed({
            title: '🗑️ Xóa Thành Công',
            description: `Đã xóa hoàn toàn mục **${category}** khỏi hệ thống!`,
            color: COLORS.SUCCESS
          })],
          components: []
        });
      }

      const reg = selectedValue;
      if (linkDoc.links?.free) delete linkDoc.links.free[reg];
      if (linkDoc.links?.premium) delete linkDoc.links.premium[reg];

      const isFreeEmpty = !linkDoc.links?.free || Object.keys(linkDoc.links.free).length === 0;
      const isPreEmpty = !linkDoc.links?.premium || Object.keys(linkDoc.links.premium).length === 0;

      if (isFreeEmpty && isPreEmpty) {
        await LinkModel.deleteOne({ category });
      } else {
        linkDoc.markModified('links');
        await linkDoc.save();
      }

      await sendOwnerLog('Xóa Khu Vực Clone', [
        { name: 'Mục', value: category, inline: true },
        { name: 'Khu vực bị xóa', value: reg.toUpperCase(), inline: true }
      ], interaction.user);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: '🗑️ Xóa Thành Công',
          description: `Đã xóa thành công bản Clone khu vực **${reg.toUpperCase()}** của mục **${category}**!`,
          color: COLORS.SUCCESS
        })],
        components: []
      });
    }

    if (customId === 'admin_select_setstatus_category') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const { cat: selectedCategory } = JSON.parse(interaction.values[0]);

      const regionSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_setstatus_region|${selectedCategory}`)
        .setPlaceholder(`--- Chọn khu vực cần đổi trạng thái ---`)
        .addOptions([
          { label: '🌍 Global', value: 'global', description: 'Chỉ đổi trạng thái cho khu vực Global' },
          { label: '🇻🇳 VNG', value: 'vng', description: 'Chỉ đổi trạng thái cho khu vực VNG' },
          { label: '⚡ Tất cả khu vực (Global & VNG)', value: 'ALL', description: 'Áp dụng cho mọi khu vực của mục này' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `⚙️ CHỌN KHU VỰC: ${selectedCategory}`,
          description: `Vui lòng chọn khu vực bạn muốn cập nhật trạng thái cho **${selectedCategory}**:`,
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(regionSelectMenu)]
      });
    }

    if (customId.startsWith('admin_setstatus_region|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const category = customId.split('|')[1];
      const selectedRegion = interaction.values[0];

      const statusSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_apply_status|${category}|${selectedRegion}`)
        .setPlaceholder(`--- Chọn trạng thái mới (${selectedRegion.toUpperCase()}) ---`)
        .addOptions([
          { label: '🟢 Hoạt động', value: 'active', description: 'Cho phép member tải xuống bình thường' },
          { label: '🟡 Đang bảo trì / Chờ update', value: 'maintenance', description: 'Ẩn link tải và hiển thị cảnh báo' },
          { label: '🔴 Ngừng hoạt động', value: 'disabled', description: 'Ẩn link tải do ngừng hỗ trợ' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `⚙️ ĐỔI TRẠNG THÁI: ${category} (${selectedRegion.toUpperCase()})`,
          description: `Vui lòng chọn trạng thái mới áp dụng:`,
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(statusSelectMenu)]
      });
    }

    if (customId.startsWith('admin_apply_status|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const parts = customId.split('|');
      const category = parts[1];
      const targetRegion = parts[2];
      const newStatus = interaction.values[0];

      const linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc || !linkDoc.links) {
        return await interaction.update({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: 'Dữ liệu không tồn tại hoặc đã bị xóa!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      ['free', 'premium'].forEach(t => {
        if (linkDoc.links[t]) {
          if (targetRegion === 'ALL') {
            for (const reg in linkDoc.links[t]) {
              if (linkDoc.links[t][reg]) {
                linkDoc.links[t][reg].status = newStatus;
              }
            }
          } else {
            if (linkDoc.links[t][targetRegion]) {
              linkDoc.links[t][targetRegion].status = newStatus;
            }
          }
        }
      });

      linkDoc.markModified('links');
      await linkDoc.save();

      const statusNames = {
        active: '🟢 Hoạt động',
        maintenance: '🟡 Đang bảo trì / Chờ update',
        disabled: '🔴 Ngừng hoạt động'
      };

      await sendOwnerLog('Đổi Trạng Thái Clone', [
        { name: 'Mục', value: category, inline: true },
        { name: 'Khu vực', value: targetRegion.toUpperCase(), inline: true },
        { name: 'Trạng thái mới', value: statusNames[newStatus], inline: true }
      ], interaction.user);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: '✅ Cập Nhật Trạng Thái Thành Công',
          description: `Đã đổi trạng thái của **${category}** (${targetRegion.toUpperCase()}) thành: **${statusNames[newStatus]}**`,
          color: COLORS.SUCCESS
        })],
        components: []
      });
    }
  }
});

/* =========================================================
   API WEBSITE — LIÊN KẾT index.html VỚI BOT (index.js)
   Website gọi các endpoint dưới đây để đăng nhập bằng Token + 2FA
   ========================================================= */
const app = express();
// Railway chạy sau proxy: cần để lấy đúng IP người dùng
app.set('trust proxy', 1);

// Chỉ cho đúng website của bạn gọi API (thêm tên miền riêng vào mảng nếu sau này có)
const ALLOWED_ORIGINS = ['https://paintool-website-tai-hack-roblox.onrender.com'];
app.use(cors({ origin: ALLOWED_ORIGINS }));

// Giới hạn số lần gọi API đăng nhập theo IP (không cần cài thêm package)
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = 30;
const rateHits = new Map();
function loginRateLimit(req, res, next) {
  const now = Date.now();
  const entry = rateHits.get(req.ip);
  if (!entry || now > entry.resetAt) {
    rateHits.set(req.ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau vài phút!' });
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateHits) if (now > entry.resetAt) rateHits.delete(ip);
}, 10 * 60 * 1000);

// Đếm số lần nhập sai mã 2FA theo token: sai 5 lần thì mã 2FA hiện tại bị hủy
const MAX_2FA_FAILS = 5;
const twoFAFails = new Map();

app.use(express.json());

function buildPublicUser(discordUser) {
  return {
    username: discordUser.username,
    displayName: discordUser.globalName || discordUser.displayName || discordUser.username,
    avatar: discordUser.displayAvatarURL({ dynamic: true, size: 256 })
  };
}

// Bước 1: kiểm tra Token (chưa cấp quyền đăng nhập, chỉ xác nhận Token đúng)
app.post('/api/login/token', loginRateLimit, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Token!' });
    }

    const authDoc = await AuthModel.findOne({ token });
    if (!authDoc) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ!' });
    }

    let discordUser = null;
    try { discordUser = await client.users.fetch(authDoc.userId); } catch (_e) {}

    return res.json({
      success: true,
      user: discordUser ? buildPublicUser(discordUser) : null
    });
  } catch (err) {
    console.error('Lỗi /api/login/token:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ, vui lòng thử lại!' });
  }
});

// Bước 2: kiểm tra mã 2FA, nếu đúng thì trả về thông tin Discord đầy đủ để website lưu phiên đăng nhập
app.post('/api/login/2fa', loginRateLimit, async (req, res) => {
  try {
    const { token, code } = req.body || {};
    if (!token || !code) {
      return res.status(400).json({ success: false, message: 'Thiếu Token hoặc mã 2FA!' });
    }

    const authDoc = await AuthModel.findOne({ token });
    if (!authDoc) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ!' });
    }

    if (!authDoc.twoFACode || !authDoc.twoFACodeExpiresAt || Date.now() > authDoc.twoFACodeExpiresAt) {
      return res.status(401).json({ success: false, message: 'Mã 2FA đã hết hạn, dùng lệnh /2fa để lấy mã mới!' });
    }

    if (String(code) !== String(authDoc.twoFACode)) {
      const fails = (twoFAFails.get(token) || 0) + 1;
      twoFAFails.set(token, fails);
      if (fails >= MAX_2FA_FAILS) {
        twoFAFails.delete(token);
        authDoc.twoFACode = undefined;
        authDoc.twoFACodeExpiresAt = undefined;
        await authDoc.save();
        return res.status(401).json({ success: false, message: 'Nhập sai quá nhiều lần, mã 2FA đã bị hủy. Dùng lệnh /2fa để lấy mã mới!' });
      }
      return res.status(401).json({ success: false, message: 'Mã 2FA không đúng!' });
    }
    twoFAFails.delete(token);

    // Mã 2FA chỉ dùng được 1 lần
    authDoc.twoFACode = undefined;
    authDoc.twoFACodeExpiresAt = undefined;
    // Tạo phiên mới: phiên cũ ở thiết bị khác sẽ tự bị đăng xuất
    authDoc.sessionId = generateSessionId();
    authDoc.sessionCreatedAt = Date.now();
    await authDoc.save();

    let discordUser = null;
    try { discordUser = await client.users.fetch(authDoc.userId); } catch (_e) {}

    return res.json({
      success: true,
      sessionId: authDoc.sessionId,
      loginAt: authDoc.sessionCreatedAt,
      expiresAt: authDoc.sessionCreatedAt + SESSION_TTL_MS,
      user: discordUser ? buildPublicUser(discordUser) : { username: 'unknown', displayName: 'Unknown', avatar: null }
    });
  } catch (err) {
    console.error('Lỗi /api/login/2fa:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ, vui lòng thử lại!' });
  }
});

// Lấy lại thông tin Discord mới nhất cho phiên đăng nhập đã lưu ở trình duyệt (mở khung "Thông tin")
app.post('/api/session/profile', loginRateLimit, async (req, res) => {
  try {
    const { token, sessionId } = req.body || {};
    const authDoc = token && await AuthModel.findOne({ token });
    if (!authDoc || !isSessionValid(authDoc, sessionId)) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không còn hợp lệ!' });
    }

    let discordUser = null;
    try { discordUser = await client.users.fetch(authDoc.userId); } catch (_e) {}
    if (!discordUser) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản Discord!' });

    return res.json({ success: true, user: buildPublicUser(discordUser) });
  } catch (err) {
    console.error('Lỗi /api/session/profile:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ, vui lòng thử lại!' });
  }
});

// Website gọi định kỳ để kiểm tra phiên: hết hạn 4 ngày / đăng nhập nơi khác / token bị reset
app.post('/api/session/check', loginRateLimit, async (req, res) => {
  try {
    const { token, sessionId } = req.body || {};
    const authDoc = token ? await AuthModel.findOne({ token }) : null;

    if (!authDoc) return res.json({ success: true, valid: false, reason: 'token_changed' });
    if (!isSessionValid(authDoc, sessionId)) {
      const expired = authDoc.sessionId === sessionId && authDoc.sessionCreatedAt &&
        Date.now() - authDoc.sessionCreatedAt > SESSION_TTL_MS;
      return res.json({ success: true, valid: false, reason: expired ? 'expired' : 'other_device' });
    }
    return res.json({ success: true, valid: true, expiresAt: authDoc.sessionCreatedAt + SESSION_TTL_MS });
  } catch (err) {
    console.error('Lỗi /api/session/check:', err);
    return res.status(500).json({ success: false });
  }
});

/* =========================================================
   HEALTH CHECK ENDPOINT - CHO UPTIMEROBOT KIỂM TRA MÁY CHỦ
   ========================================================= */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    bot: client.isReady() ? 'online' : 'offline'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    bot_status: client.isReady() ? 'online' : 'offline'
  });
});

/* =========================================================
   RENDER & UPTIMEROBOT COMPATIBLE SERVER CONFIGURATION
   ========================================================= */
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ API Server running on ${HOST}:${PORT}`);
  console.log(`🌐 API Website đang chạy tại cổng ${PORT}`);
});

client.once('ready', () => { 
  console.log(`🤖 Bot ${client.user.tag} đã sẵn sàng hoạt động!`); 
});

client.login(TOKEN);
